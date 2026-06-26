from __future__ import annotations

import math
import os
import re
import time
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import pytesseract
from pytesseract import Output

from .scene import (
    SceneDetection,
    capabilities as scene_capabilities,
    detect_helmets,
    detect_scene,
    estimate_traffic_light_state,
    make_evidence_image,
    possible_phone_interactions,
    vehicle_boxes,
)

PLATE_REGEX = re.compile(r"^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$")
VALID_STATE_CODES = {
    "AP", "AR", "AS", "BR", "CG", "GA", "GJ", "HR", "HP", "JH", "KA", "KL",
    "MP", "MH", "MN", "ML", "MZ", "NL", "OD", "OR", "PB", "RJ", "SK", "TN",
    "TS", "TR", "UP", "UK", "WB", "AN", "CH", "DD", "DH", "DL", "JK", "LA",
    "LD", "PY",
}
LETTER_FIX = {"0": "O", "1": "I", "5": "S", "8": "B", "2": "Z", "6": "G", "4": "A"}
DIGIT_FIX = {"O": "0", "I": "1", "L": "1", "S": "5", "B": "8", "Z": "2", "G": "6", "Q": "0", "A": "4"}
CASCADE_PATH = cv2.data.haarcascades + "haarcascade_russian_plate_number.xml"
PLATE_CASCADE = cv2.CascadeClassifier(CASCADE_PATH)


@dataclass(frozen=True)
class OcrRead:
    text: str
    ocr_confidence: float
    frame_sec: float
    bbox: tuple[int, int, int, int]
    evidence_image: str | None


def normalize_plate(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", value.upper())


def is_valid_indian_plate(value: str) -> bool:
    return bool(PLATE_REGEX.fullmatch(value) and value[:2] in VALID_STATE_CODES)


def fix_plate_text(text: str) -> str | None:
    text = normalize_plate(text)
    if not 8 <= len(text) <= 11:
        return None
    for rto_len in (2, 1):
        for series_len in (1, 2, 3):
            if 2 + rto_len + series_len + 4 != len(text):
                continue
            state = text[:2]
            rto = text[2:2 + rto_len]
            series = text[2 + rto_len:2 + rto_len + series_len]
            number = text[-4:]
            state_fixed = "".join(c if c.isalpha() else LETTER_FIX.get(c, c) for c in state)
            rto_fixed = "".join(c if c.isdigit() else DIGIT_FIX.get(c, c) for c in rto)
            series_fixed = "".join(c if c.isalpha() else LETTER_FIX.get(c, c) for c in series)
            number_fixed = "".join(c if c.isdigit() else DIGIT_FIX.get(c, c) for c in number)
            candidate = state_fixed + rto_fixed + series_fixed + number_fixed
            if is_valid_indian_plate(candidate):
                return candidate
    return None


def _edit_distance(a: str, b: str) -> int:
    if a == b:
        return 0
    if abs(len(a) - len(b)) > 1:
        return 2
    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        current = [i]
        for j, cb in enumerate(b, start=1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (ca != cb)))
        previous = current
    return previous[-1]


def _ocr_variant(image: np.ndarray, psm: int) -> tuple[str | None, float]:
    config = f"--oem 3 --psm {psm} -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    timeout = float(os.getenv("VISION_OCR_TIMEOUT_SECONDS", "2.5"))
    try:
        text = normalize_plate(pytesseract.image_to_string(image, config=config, timeout=timeout))
    except RuntimeError:
        return None, 0.0
    if not text:
        return None, 0.0
    candidate = text if is_valid_indian_plate(text) else fix_plate_text(text)
    if not candidate:
        return None, 0.0
    # Tesseract string mode is faster than per-token confidence extraction. Final
    # evidence confidence is strengthened by multi-variant and multi-frame voting.
    return candidate, 0.58


def _unsharp(image: np.ndarray) -> np.ndarray:
    blurred = cv2.GaussianBlur(image, (0, 0), 2.2)
    return cv2.addWeighted(image, 1.85, blurred, -0.85, 0)


def _perspective_rectify(gray_roi: np.ndarray) -> np.ndarray:
    edges = cv2.Canny(gray_roi, 70, 190)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:12]:
        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.03 * perimeter, True)
        if len(approx) != 4:
            continue
        points = approx.reshape(4, 2).astype("float32")
        sums = points.sum(axis=1)
        diffs = np.diff(points, axis=1).reshape(-1)
        rect = np.array([
            points[np.argmin(sums)],
            points[np.argmin(diffs)],
            points[np.argmax(sums)],
            points[np.argmax(diffs)],
        ], dtype="float32")
        tl, tr, br, bl = rect
        width = int(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl)))
        height = int(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl)))
        if width < 45 or height < 12 or not 2.0 <= width / max(height, 1) <= 7.5:
            continue
        destination = np.array([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]], dtype="float32")
        matrix = cv2.getPerspectiveTransform(rect, destination)
        return cv2.warpPerspective(gray_roi, matrix, (width, height))
    return gray_roi


def read_plate_from_roi(gray_roi: np.ndarray) -> tuple[str | None, float]:
    if gray_roi.size == 0:
        return None, 0.0
    height, width = gray_roi.shape[:2]
    if height < 10 or width < 30:
        return None, 0.0
    gray_roi = _perspective_rectify(gray_roi)
    height = gray_roi.shape[0]
    scale = max(2.5, min(6.0, 220.0 / max(height, 1)))
    enlarged = cv2.resize(gray_roi, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    clahe = cv2.createCLAHE(clipLimit=2.4, tileGridSize=(8, 8)).apply(enlarged)
    denoised = cv2.bilateralFilter(clahe, 9, 48, 48)
    sharpened = _unsharp(denoised)
    variants = [
        cv2.threshold(sharpened, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1],
        cv2.adaptiveThreshold(sharpened, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 7),
    ]
    candidates: list[tuple[str, float]] = []
    for variant in variants:
        text, confidence = _ocr_variant(variant, 7)
        if text:
            candidates.append((text, confidence))
    if not candidates:
        return None, 0.0
    counts = Counter(text for text, _ in candidates)
    best_text = max(counts, key=lambda text: (counts[text], max(c for t, c in candidates if t == text)))
    best_confidence = max(c for t, c in candidates if t == best_text)
    agreement_bonus = min(0.18, (counts[best_text] - 1) * 0.03)
    return best_text, min(0.99, best_confidence + agreement_bonus)


def _iou(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> float:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    x1, y1 = max(ax, bx), max(ay, by)
    x2, y2 = min(ax + aw, bx + bw), min(ay + ah, by + bh)
    intersection = max(0, x2 - x1) * max(0, y2 - y1)
    union = aw * ah + bw * bh - intersection
    return intersection / union if union > 0 else 0.0


def _contour_plate_candidates(gray: np.ndarray) -> list[tuple[int, int, int, int]]:
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    blurred = cv2.GaussianBlur(clahe, (5, 5), 0)
    gradient = cv2.Sobel(blurred, cv2.CV_8U, 1, 0, ksize=3)
    _, thresholded = cv2.threshold(gradient, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (19, 5))
    closed = cv2.morphologyEx(thresholded, cv2.MORPH_CLOSE, kernel, iterations=2)
    closed = cv2.erode(closed, None, iterations=1)
    closed = cv2.dilate(closed, None, iterations=2)
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    height, width = gray.shape[:2]
    frame_area = max(1, height * width)
    candidates: list[tuple[int, int, int, int]] = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if h <= 0:
            continue
        aspect = w / h
        area_ratio = (w * h) / frame_area
        if 1.8 <= aspect <= 8.5 and w >= 42 and h >= 10 and 0.00015 <= area_ratio <= 0.18:
            candidates.append((x, y, w, h))
    return sorted(candidates, key=lambda item: item[2] * item[3], reverse=True)[:24]


def _combine_candidates(*candidate_sets: Any) -> list[tuple[int, int, int, int]]:
    combined: list[tuple[int, int, int, int]] = []
    for candidate_set in candidate_sets:
        for item in candidate_set:
            candidate = tuple(int(value) for value in item)
            if all(_iou(candidate, existing) < 0.42 for existing in combined):
                combined.append(candidate)
    return combined


def _vehicle_guided_candidates(gray: np.ndarray, boxes: list[tuple[int, int, int, int]]) -> list[tuple[int, int, int, int]]:
    candidates: list[tuple[int, int, int, int]] = []
    frame_h, frame_w = gray.shape[:2]
    for vx1, vy1, vx2, vy2 in boxes[:12]:
        width = max(1, vx2 - vx1)
        height = max(1, vy2 - vy1)
        x1 = max(0, int(vx1 - width * 0.04))
        y1 = max(0, int(vy1 + height * 0.35))
        x2 = min(frame_w, int(vx2 + width * 0.04))
        y2 = min(frame_h, int(vy2 + height * 0.08))
        roi = gray[y1:y2, x1:x2]
        if roi.size == 0:
            continue
        cascade = PLATE_CASCADE.detectMultiScale(
            cv2.equalizeHist(roi), scaleFactor=1.04, minNeighbors=3, minSize=(38, 10), maxSize=(500, 180)
        )
        contour = _contour_plate_candidates(roi)
        for x, y, w, h in _combine_candidates(cascade, contour):
            candidates.append((x + x1, y + y1, w, h))
    return candidates


def _candidate_score(gray: np.ndarray, candidate: tuple[int, int, int, int]) -> float:
    x, y, w, h = candidate
    roi = gray[max(0, y):max(0, y + h), max(0, x):max(0, x + w)]
    if roi.size == 0 or h <= 0:
        return -1.0
    aspect = w / h
    aspect_score = max(0.0, 1.0 - abs(aspect - 4.2) / 4.2)
    sharpness = min(1.0, float(cv2.Laplacian(roi, cv2.CV_64F).var()) / 550.0)
    edges = cv2.Canny(roi, 70, 180)
    edge_density = min(1.0, float(cv2.countNonZero(edges)) / max(1, roi.size) * 8.0)
    size_score = min(1.0, (w * h) / 18000.0)
    return aspect_score * 0.28 + sharpness * 0.32 + edge_density * 0.25 + size_score * 0.15


def _merge_near_duplicates(reads: list[OcrRead]) -> dict[str, list[OcrRead]]:
    groups: dict[str, list[OcrRead]] = {}
    for item in sorted(reads, key=lambda value: value.ocr_confidence, reverse=True):
        representative = next((key for key in groups if len(key) == len(item.text) and key[:2] == item.text[:2] and _edit_distance(key, item.text) <= 1), None)
        groups.setdefault(representative or item.text, []).append(item)
    return groups


def _merge_observations(observations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for item in observations:
        grouped.setdefault((item["type"], item.get("label", item["type"])), []).append(item)
    merged: list[dict[str, Any]] = []
    for (_, _), group in grouped.items():
        strongest = max(group, key=lambda value: float(value.get("confidence", 0)))
        merged.append({
            **strongest,
            "first_seen_sec": round(min(float(value.get("first_seen_sec", 0)) for value in group), 2),
            "last_seen_sec": round(max(float(value.get("last_seen_sec", value.get("first_seen_sec", 0))) for value in group), 2),
            "occurrences": len(group),
            "confidence": round(max(float(value.get("confidence", 0)) for value in group), 2),
        })
    return sorted(merged, key=lambda value: float(value.get("confidence", 0)), reverse=True)


def _plate_result_state(expected: str | None, detections: list[dict[str, Any]], candidate_regions: int) -> str:
    if expected and any(item["matches_expected_plate"] for item in detections):
        return "matched"
    if detections:
        best = max(float(item["confidence"]) for item in detections)
        if best < 0.58:
            return "low_confidence"
        return "mismatch" if expected else "plate_detected"
    return "unreadable" if candidate_regions > 0 else "no_plate"


def analyze_video(
    path: str | Path,
    *,
    expected_plate: str | None = None,
    sample_interval_seconds: float = 0.4,
    max_sampled_frames: int = 180,
    include_debug_thumbnail: bool = True,
) -> dict[str, Any]:
    started = time.perf_counter()
    path = str(path)
    expected = normalize_plate(expected_plate or "") or None
    if PLATE_CASCADE.empty():
        raise RuntimeError("OpenCV number-plate cascade could not be loaded")
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise ValueError("The uploaded file could not be opened as a video")
    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or not math.isfinite(fps) or fps <= 0:
        fps = 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration_seconds = (total_frames / fps) if total_frames > 0 else 0.0
    sample_every = max(1, int(round(fps * max(sample_interval_seconds, 0.2))))
    max_width = int(os.getenv("VISION_DETECT_MAX_WIDTH", "1280"))
    max_candidates = int(os.getenv("VISION_MAX_CANDIDATES_PER_FRAME", "3"))
    minimum_sharpness = float(os.getenv("VISION_MIN_FRAME_SHARPNESS", "18"))

    reads: list[OcrRead] = []
    scene_observations: list[dict[str, Any]] = []
    evidence_frames: list[dict[str, Any]] = []
    sampled_frames = 0
    sharp_frames = 0
    candidate_regions = 0
    frame_index = 0
    object_counts: Counter[str] = Counter()
    best_unreadable: tuple[float, np.ndarray, tuple[int, int, int, int], float] | None = None
    exact_expected_reads = 0

    try:
        while sampled_frames < max_sampled_frames:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
            ok, frame = cap.read()
            if not ok:
                break
            sampled_frames += 1
            frame_sec = round(frame_index / fps, 2)
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
            if sharpness >= minimum_sharpness:
                sharp_frames += 1

            scene_detections: list[SceneDetection] = detect_scene(frame, frame_sec)
            helmet_detections: list[SceneDetection] = detect_helmets(frame, frame_sec)
            for item in scene_detections:
                object_counts[item.label] += 1
            for item in helmet_detections:
                object_counts[item.label] += 1

            for phone in possible_phone_interactions(scene_detections):
                if include_debug_thumbnail and len(evidence_frames) < 5:
                    bbox = phone["bbox"]
                    image = make_evidence_image(frame, bbox=(bbox["x1"], bbox["y1"], bbox["x2"], bbox["y2"]), label="Review phone observation")
                    if image:
                        evidence_frames.append({"kind": "phone", "title": "Possible phone interaction", "timestamp_sec": frame_sec, "confidence": phone["confidence"], "image_data_url": image})
                scene_observations.append(phone)

            for light in [item for item in scene_detections if item.label == "traffic light"]:
                state, state_confidence = estimate_traffic_light_state(frame, light.bbox)
                scene_observations.append({
                    "type": "traffic_light_visible",
                    "label": f"Traffic light visible · {state}",
                    "status": "observed" if state != "unknown" else "review_required",
                    "confidence": round(min(light.confidence, max(0.2, state_confidence)), 2),
                    "first_seen_sec": frame_sec,
                    "last_seen_sec": frame_sec,
                    "bbox": {"x1": light.bbox[0], "y1": light.bbox[1], "x2": light.bbox[2], "y2": light.bbox[3]},
                    "source": "object-detection-colour-estimate",
                    "review_required": True,
                    "note": "The light is visible and its colour is estimated. Signal compliance is not inferred without a calibrated stop line and vehicle track.",
                })

            for helmet in helmet_detections:
                normalized = helmet.label.lower()
                without = any(token in normalized for token in ("no_helmet", "without_helmet", "nohelmet"))
                scene_observations.append({
                    "type": "helmet_observation",
                    "label": "Possible missing helmet" if without else "Helmet visible",
                    "status": "review_required" if without else "observed",
                    "confidence": round(helmet.confidence, 2),
                    "first_seen_sec": frame_sec,
                    "last_seen_sec": frame_sec,
                    "bbox": {"x1": helmet.bbox[0], "y1": helmet.bbox[1], "x2": helmet.bbox[2], "y2": helmet.bbox[3]},
                    "source": "configured-helmet-model",
                    "review_required": without,
                    "note": "Helmet observations require the optional dedicated helmet model and human review for low-confidence footage.",
                })

            full_h, full_w = gray.shape[:2]
            scale = min(1.0, max_width / max(full_w, 1))
            detect_gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1.0 else gray
            detect_gray = cv2.equalizeHist(detect_gray)
            cascade = PLATE_CASCADE.detectMultiScale(detect_gray, scaleFactor=1.04, minNeighbors=3, minSize=(42, 11), maxSize=(520, 190))
            contours = _contour_plate_candidates(detect_gray)
            full_candidates: list[tuple[int, int, int, int]] = []
            for x, y, w, h in _combine_candidates(cascade, contours):
                full_candidates.append(tuple(int(round(value / scale)) for value in (x, y, w, h)))
            guided = _vehicle_guided_candidates(gray, vehicle_boxes(scene_detections))
            # When vehicles are available, prioritise their lower regions and only
            # keep a small full-frame fallback set. This avoids expensive OCR on
            # unrelated road signs, windows and body panels.
            fallback = full_candidates[:3] if guided else full_candidates
            candidates = _combine_candidates(guided, fallback)
            candidates = [item for item in candidates if _candidate_score(gray, item) >= 0.16]
            candidates = sorted(candidates, key=lambda item: _candidate_score(gray, item), reverse=True)

            # Blurry frames still contribute scene context, but OCR focuses on sharper samples.
            if sharpness < minimum_sharpness and sampled_frames > 3:
                frame_index += sample_every
                if total_frames > 0 and frame_index >= total_frames:
                    break
                continue

            for x, y, w, h in candidates[:max_candidates]:
                candidate_regions += 1
                pad_x = max(4, int(w * 0.10))
                pad_y = max(3, int(h * 0.28))
                x1, y1 = max(0, x - pad_x), max(0, y - pad_y)
                x2, y2 = min(full_w, x + w + pad_x), min(full_h, y + h + pad_y)
                roi = gray[y1:y2, x1:x2]
                roi_sharpness = float(cv2.Laplacian(roi, cv2.CV_64F).var()) if roi.size else 0.0
                if best_unreadable is None or roi_sharpness > best_unreadable[0]:
                    best_unreadable = (roi_sharpness, frame.copy(), (x1, y1, x2, y2), frame_sec)
                plate_text, ocr_confidence = read_plate_from_roi(roi)
                if not plate_text:
                    continue
                evidence_image = make_evidence_image(frame, bbox=(x1, y1, x2, y2), label=plate_text) if include_debug_thumbnail else None
                reads.append(OcrRead(plate_text, ocr_confidence, frame_sec, (x1, y1, x2, y2), evidence_image))
                if expected and plate_text == expected:
                    exact_expected_reads += 1
                    if exact_expected_reads >= 3:
                        break

            if exact_expected_reads >= 3:
                break
            frame_index += sample_every
            if total_frames > 0 and frame_index >= total_frames:
                break
    finally:
        cap.release()

    groups = _merge_near_duplicates(reads)
    detections: list[dict[str, Any]] = []
    for _, group in groups.items():
        votes = len(group)
        mean_ocr = sum(item.ocr_confidence for item in group) / votes
        exact_votes = Counter(item.text for item in group)
        plate = max(exact_votes, key=lambda text: (exact_votes[text], sum(item.ocr_confidence for item in group if item.text == text)))
        strongest = max(group, key=lambda item: item.ocr_confidence)
        consistency = min(1.0, votes / max(2, sharp_frames * 0.10))
        confidence = round(min(0.99, 0.32 + mean_ocr * 0.40 + consistency * 0.28), 2)
        x1, y1, x2, y2 = strongest.bbox
        detections.append({
            "plate": plate,
            "state_code": plate[:2],
            "first_seen_sec": round(min(item.frame_sec for item in group), 2),
            "last_seen_sec": round(max(item.frame_sec for item in group), 2),
            "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
            "read_count": votes,
            "ocr_confidence": round(mean_ocr, 2),
            "confidence": confidence,
            "matches_expected_plate": bool(expected and plate == expected),
            "evidence_image": strongest.evidence_image,
        })
    detections.sort(key=lambda item: (item["matches_expected_plate"], item["confidence"], item["read_count"]), reverse=True)
    detections = detections[:15]
    matched = next((item for item in detections if item["matches_expected_plate"]), None)
    result_state = _plate_result_state(expected, detections, candidate_regions)

    for detection in detections[:3]:
        if detection.get("evidence_image"):
            evidence_frames.append({
                "kind": "plate",
                "title": f"Plate evidence · {detection['plate']}",
                "timestamp_sec": detection["first_seen_sec"],
                "confidence": detection["confidence"],
                "image_data_url": detection["evidence_image"],
            })
    if not detections and best_unreadable and include_debug_thumbnail:
        _, frame, bbox, frame_sec = best_unreadable
        image = make_evidence_image(frame, bbox=bbox, label="Plate candidate", crop=True)
        if image:
            evidence_frames.append({"kind": "plate_candidate", "title": "Best unreadable plate candidate", "timestamp_sec": frame_sec, "confidence": 0.0, "image_data_url": image})

    caps = scene_capabilities()
    observations = _merge_observations(scene_observations)
    compliance = {
        "vehicle_presence": {
            "status": "observed" if sum(object_counts[label] for label in ("car", "motorcycle", "bus", "truck", "bicycle")) else "not_detected",
            "confidence": max([item.confidence for item in []], default=0.0),
            "note": "Generic object detection confirms visible road users; it does not identify ownership by itself.",
        },
        "helmet": {
            "status": "observed" if any(item["type"] == "helmet_observation" and item["status"] == "observed" for item in observations) else "review_required" if any(item["type"] == "helmet_observation" for item in observations) else "not_analyzed",
            "note": "Requires a dedicated helmet model configured through VISION_HELMET_MODEL_PATH." if not caps["helmet_detection"]["available"] else "Dedicated helmet model observations are shown with confidence and review status.",
        },
        "phone_use": {
            "status": "review_required" if any(item["type"] == "possible_phone_interaction" for item in observations) else "not_detected",
            "note": "Phone-object proximity is review-only and never creates an automatic penalty.",
        },
        "traffic_signal": {
            "status": "observed" if any(item["type"] == "traffic_light_visible" for item in observations) else "not_detected",
            "note": "A visible-light colour estimate is not the same as red-light violation detection.",
        },
        "lane_discipline": {
            "status": "not_analyzed",
            "note": "Lane and wrong-side analysis requires camera calibration and road-direction geometry.",
        },
    }

    warnings = [
        "Video observations are evidence for review; they do not change GPS score or rewards automatically.",
        "Signal compliance and lane discipline require a calibrated camera view and are not inferred from an arbitrary upload.",
    ]
    if result_state == "no_plate":
        warnings.append("No plate-shaped region was detected. Use a closer, steadier view of the vehicle.")
    elif result_state == "unreadable":
        warnings.append("Plate candidates were found, but no valid Indian registration number was read confidently.")
    elif result_state == "low_confidence":
        warnings.append("A possible plate was read, but the evidence confidence is too low for verification.")
    elif result_state == "mismatch":
        warnings.append("A readable plate was found, but it did not match the selected vehicle.")

    return {
        "analysis_version": "vision-fusion-v3",
        "result_state": result_state,
        "detector": {
            "plate_locator": "vehicle-guided-opencv-hybrid",
            "ocr": "tesseract-multipass",
            "behaviour_model": "yolov8n-coco" if caps["object_detection"]["available"] else None,
            "helmet_model": caps["helmet_detection"]["model"],
        },
        "capabilities": caps,
        "video": {
            "duration_seconds": round(duration_seconds, 2),
            "fps": round(fps, 2),
            "sampled_frames": sampled_frames,
            "sharp_frames": sharp_frames,
            "candidate_regions": candidate_regions,
        },
        "expected_plate": expected,
        "matched_registered_plate": bool(matched),
        "matched_plate": matched["plate"] if matched else None,
        "detections": detections,
        "observations": observations,
        "compliance": compliance,
        "evidence_frames": evidence_frames[:6],
        "summary": {
            "unique_plates": len(detections),
            "raw_ocr_reads": len(reads),
            "processing_ms": int((time.perf_counter() - started) * 1000),
            "objects_detected": int(sum(object_counts.values())),
            "vehicle_detections": int(sum(object_counts[label] for label in ("car", "motorcycle", "bus", "truck", "bicycle"))),
            "person_detections": int(object_counts["person"]),
            "phone_detections": int(object_counts["cell phone"]),
            "traffic_light_detections": int(object_counts["traffic light"]),
            "helmet_detections": int(sum(count for label, count in object_counts.items() if "helmet" in label)),
        },
        "warnings": warnings,
    }
