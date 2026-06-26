from __future__ import annotations

import base64
import os
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np

try:
    from ultralytics import YOLO  # type: ignore
except Exception:  # pragma: no cover - optional dependency fallback
    YOLO = None  # type: ignore

RELEVANT_LABELS = {
    "person",
    "bicycle",
    "car",
    "motorcycle",
    "bus",
    "truck",
    "traffic light",
    "cell phone",
}
VEHICLE_LABELS = {"bicycle", "car", "motorcycle", "bus", "truck"}

_MODEL_LOCK = threading.Lock()
_OBJECT_MODEL: Any | None = None
_HELMET_MODEL: Any | None = None
_OBJECT_MODEL_ERROR: str | None = None
_HELMET_MODEL_ERROR: str | None = None


@dataclass(frozen=True)
class SceneDetection:
    label: str
    confidence: float
    bbox: tuple[int, int, int, int]
    frame_sec: float


def _resolve_path(value: str | None, default: Path | None = None) -> Path | None:
    if value:
        candidate = Path(value).expanduser()
        if not candidate.is_absolute():
            candidate = (Path.cwd() / candidate).resolve()
        return candidate
    return default.resolve() if default else None


def _object_model_path() -> Path | None:
    default = Path(__file__).resolve().parents[1] / "models" / "yolov8n.pt"
    return _resolve_path(os.getenv("VISION_OBJECT_MODEL_PATH"), default)


def _helmet_model_path() -> Path | None:
    return _resolve_path(os.getenv("VISION_HELMET_MODEL_PATH"))


def get_object_model() -> Any | None:
    global _OBJECT_MODEL, _OBJECT_MODEL_ERROR
    if _OBJECT_MODEL is not None or _OBJECT_MODEL_ERROR is not None:
        return _OBJECT_MODEL
    with _MODEL_LOCK:
        if _OBJECT_MODEL is not None or _OBJECT_MODEL_ERROR is not None:
            return _OBJECT_MODEL
        if YOLO is None:
            _OBJECT_MODEL_ERROR = "Ultralytics is not installed"
            return None
        path = _object_model_path()
        if not path or not path.exists():
            _OBJECT_MODEL_ERROR = "Object model file was not found"
            return None
        try:
            _OBJECT_MODEL = YOLO(str(path))
        except Exception as exc:  # pragma: no cover - model/runtime dependent
            _OBJECT_MODEL_ERROR = f"Model load failed ({type(exc).__name__})"
        return _OBJECT_MODEL


def get_helmet_model() -> Any | None:
    global _HELMET_MODEL, _HELMET_MODEL_ERROR
    if _HELMET_MODEL is not None or _HELMET_MODEL_ERROR is not None:
        return _HELMET_MODEL
    with _MODEL_LOCK:
        if _HELMET_MODEL is not None or _HELMET_MODEL_ERROR is not None:
            return _HELMET_MODEL
        if YOLO is None:
            _HELMET_MODEL_ERROR = "Ultralytics is not installed"
            return None
        path = _helmet_model_path()
        if not path:
            _HELMET_MODEL_ERROR = "No helmet model configured"
            return None
        if not path.exists():
            _HELMET_MODEL_ERROR = "Configured helmet model file was not found"
            return None
        try:
            _HELMET_MODEL = YOLO(str(path))
        except Exception as exc:  # pragma: no cover
            _HELMET_MODEL_ERROR = f"Model load failed ({type(exc).__name__})"
        return _HELMET_MODEL


def capabilities() -> dict[str, Any]:
    object_model = get_object_model()
    helmet_model = get_helmet_model()
    return {
        "object_detection": {
            "available": object_model is not None,
            "model": _object_model_path().name if object_model is not None and _object_model_path() else None,
            "message": _OBJECT_MODEL_ERROR,
        },
        "helmet_detection": {
            "available": helmet_model is not None,
            "model": _helmet_model_path().name if helmet_model is not None and _helmet_model_path() else None,
            "message": _HELMET_MODEL_ERROR,
        },
        "phone_observation": {
            "available": object_model is not None,
            "mode": "review-only proximity observation",
        },
        "traffic_light_observation": {
            "available": object_model is not None,
            "mode": "visible-state estimate only",
        },
        "lane_and_signal_violation": {
            "available": False,
            "message": "Camera calibration, stop-line geometry and lane direction are required",
        },
    }


def _names_for(model: Any, result: Any) -> dict[int, str]:
    names = getattr(result, "names", None) or getattr(model, "names", None) or {}
    if isinstance(names, list):
        return {index: str(name) for index, name in enumerate(names)}
    return {int(index): str(name) for index, name in dict(names).items()}


def detect_scene(frame: np.ndarray, frame_sec: float) -> list[SceneDetection]:
    model = get_object_model()
    if model is None:
        return []
    confidence = float(os.getenv("VISION_OBJECT_CONFIDENCE", "0.28"))
    image_size = int(os.getenv("VISION_OBJECT_IMAGE_SIZE", "640"))
    try:
        result = model.predict(source=frame, conf=confidence, imgsz=image_size, verbose=False, device="cpu")[0]
    except Exception:  # pragma: no cover - runtime/model dependent
        return []
    names = _names_for(model, result)
    detections: list[SceneDetection] = []
    boxes = getattr(result, "boxes", None)
    if boxes is None:
        return detections
    for box in boxes:
        try:
            class_id = int(box.cls[0].item())
            label = names.get(class_id, str(class_id)).lower()
            if label not in RELEVANT_LABELS:
                continue
            score = float(box.conf[0].item())
            x1, y1, x2, y2 = [int(round(value)) for value in box.xyxy[0].tolist()]
            if x2 <= x1 or y2 <= y1:
                continue
            detections.append(SceneDetection(label, score, (x1, y1, x2, y2), frame_sec))
        except Exception:
            continue
    return detections


def detect_helmets(frame: np.ndarray, frame_sec: float) -> list[SceneDetection]:
    model = get_helmet_model()
    if model is None:
        return []
    confidence = float(os.getenv("VISION_HELMET_CONFIDENCE", "0.35"))
    image_size = int(os.getenv("VISION_HELMET_IMAGE_SIZE", "640"))
    try:
        result = model.predict(source=frame, conf=confidence, imgsz=image_size, verbose=False, device="cpu")[0]
    except Exception:  # pragma: no cover
        return []
    names = _names_for(model, result)
    detections: list[SceneDetection] = []
    boxes = getattr(result, "boxes", None)
    if boxes is None:
        return detections
    for box in boxes:
        try:
            class_id = int(box.cls[0].item())
            label = names.get(class_id, str(class_id)).lower().replace("-", "_").replace(" ", "_")
            score = float(box.conf[0].item())
            x1, y1, x2, y2 = [int(round(value)) for value in box.xyxy[0].tolist()]
            detections.append(SceneDetection(label, score, (x1, y1, x2, y2), frame_sec))
        except Exception:
            continue
    return detections


def vehicle_boxes(detections: list[SceneDetection]) -> list[tuple[int, int, int, int]]:
    return [item.bbox for item in detections if item.label in VEHICLE_LABELS]


def _intersection_ratio(inner: tuple[int, int, int, int], outer: tuple[int, int, int, int]) -> float:
    ix1, iy1, ix2, iy2 = inner
    ox1, oy1, ox2, oy2 = outer
    x1, y1 = max(ix1, ox1), max(iy1, oy1)
    x2, y2 = min(ix2, ox2), min(iy2, oy2)
    intersection = max(0, x2 - x1) * max(0, y2 - y1)
    area = max(1, (ix2 - ix1) * (iy2 - iy1))
    return intersection / area


def possible_phone_interactions(detections: list[SceneDetection]) -> list[dict[str, Any]]:
    people = [item for item in detections if item.label == "person"]
    phones = [item for item in detections if item.label == "cell phone"]
    results: list[dict[str, Any]] = []
    for phone in phones:
        px1, py1, px2, py2 = phone.bbox
        matched_person: SceneDetection | None = None
        best_ratio = 0.0
        for person in people:
            x1, y1, x2, y2 = person.bbox
            width, height = x2 - x1, y2 - y1
            expanded = (
                int(x1 - width * 0.18),
                int(y1 - height * 0.10),
                int(x2 + width * 0.18),
                int(y2 + height * 0.10),
            )
            ratio = _intersection_ratio(phone.bbox, expanded)
            if ratio > best_ratio:
                best_ratio = ratio
                matched_person = person
        if matched_person and best_ratio >= 0.35:
            results.append(
                {
                    "type": "possible_phone_interaction",
                    "label": "Possible handheld phone interaction",
                    "status": "review_required",
                    "confidence": round(min(phone.confidence, matched_person.confidence) * best_ratio, 2),
                    "first_seen_sec": phone.frame_sec,
                    "last_seen_sec": phone.frame_sec,
                    "bbox": {"x1": px1, "y1": py1, "x2": px2, "y2": py2},
                    "source": "object-detection-proximity",
                    "review_required": True,
                    "note": "A phone-shaped object appeared close to a detected person. This is an observation, not an automatic violation.",
                }
            )
    return results


def estimate_traffic_light_state(frame: np.ndarray, bbox: tuple[int, int, int, int]) -> tuple[str, float]:
    x1, y1, x2, y2 = bbox
    roi = frame[max(0, y1):max(0, y2), max(0, x1):max(0, x2)]
    if roi.size == 0:
        return "unknown", 0.0
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    masks = {
        "red": cv2.inRange(hsv, np.array([0, 90, 100]), np.array([12, 255, 255]))
        + cv2.inRange(hsv, np.array([165, 90, 100]), np.array([179, 255, 255])),
        "yellow": cv2.inRange(hsv, np.array([15, 80, 110]), np.array([38, 255, 255])),
        "green": cv2.inRange(hsv, np.array([40, 65, 80]), np.array([95, 255, 255])),
    }
    area = max(1, roi.shape[0] * roi.shape[1])
    ratios = {name: float(cv2.countNonZero(mask)) / area for name, mask in masks.items()}
    state = max(ratios, key=ratios.get)
    ratio = ratios[state]
    if ratio < 0.025:
        return "unknown", round(ratio, 3)
    return state, round(min(1.0, ratio * 8.0), 2)


def make_evidence_image(
    frame: np.ndarray,
    *,
    bbox: tuple[int, int, int, int] | None = None,
    label: str | None = None,
    crop: bool = False,
    max_width: int = 720,
    quality: int = 72,
) -> str | None:
    rendered = frame.copy()
    if bbox:
        x1, y1, x2, y2 = bbox
        if crop:
            pad_x = max(6, int((x2 - x1) * 0.18))
            pad_y = max(6, int((y2 - y1) * 0.32))
            rendered = rendered[max(0, y1 - pad_y):min(frame.shape[0], y2 + pad_y), max(0, x1 - pad_x):min(frame.shape[1], x2 + pad_x)]
        else:
            cv2.rectangle(rendered, (x1, y1), (x2, y2), (20, 190, 100), 3)
            if label:
                cv2.putText(rendered, label, (x1, max(24, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (20, 190, 100), 2, cv2.LINE_AA)
    if rendered.size == 0:
        return None
    height, width = rendered.shape[:2]
    if width > max_width:
        scale = max_width / width
        rendered = cv2.resize(rendered, (max_width, max(1, int(height * scale))), interpolation=cv2.INTER_AREA)
    ok, encoded = cv2.imencode(".jpg", rendered, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        return None
    return "data:image/jpeg;base64," + base64.b64encode(encoded).decode("ascii")
