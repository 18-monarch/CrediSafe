from __future__ import annotations

import asyncio
import hmac
import logging
import os
import tempfile
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import cv2
import pytesseract
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pytesseract import TesseractNotFoundError

from .plate import analyze_video, normalize_plate
from .scene import capabilities

# Local development reads the repository-level .env.local. Hosted platforms inject
# environment variables directly, so no secret file is needed in production.
load_dotenv(Path.cwd() / ".env.local", override=False)
load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)

SERVICE_NAME = "credisafe-vision"
SERVICE_VERSION = "3.3.0"
SERVICE_ENV = os.getenv("VISION_ENV", "development").strip().lower() or "development"

logging.basicConfig(
    level=os.getenv("VISION_LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(SERVICE_NAME)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(maximum, value))


def _env_float(name: str, default: float, minimum: float, maximum: float) -> float:
    try:
        value = float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(maximum, value))


MAX_UPLOAD_MB = _env_int("VISION_MAX_UPLOAD_MB", 25, 1, 100)
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
SAMPLE_INTERVAL_SECONDS = _env_float("VISION_SAMPLE_INTERVAL_SECONDS", 0.4, 0.2, 5.0)
MAX_SAMPLED_FRAMES = _env_int("VISION_MAX_SAMPLED_FRAMES", 120, 1, 600)
MAX_CONCURRENT_ANALYSES = _env_int("VISION_MAX_CONCURRENT_ANALYSES", 1, 1, 2)
QUEUE_WAIT_SECONDS = _env_float("VISION_QUEUE_WAIT_SECONDS", 3.0, 0.1, 30.0)
INCLUDE_EVIDENCE_IMAGES = _env_bool("VISION_INCLUDE_EVIDENCE_IMAGES", True)
REQUIRE_API_KEY = _env_bool("VISION_REQUIRE_API_KEY", True)
PRELOAD_MODELS = _env_bool("VISION_PRELOAD_MODELS", False)
EXPOSE_INTERNAL_ERRORS = _env_bool("VISION_EXPOSE_INTERNAL_ERRORS", SERVICE_ENV != "production")

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".m4v", ".avi", ".webm", ".mkv"}
ALLOWED_CONTENT_TYPES = {
    "",
    "application/octet-stream",
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-m4v",
    "video/x-msvideo",
    "video/x-matroska",
}

analysis_slots = asyncio.Semaphore(MAX_CONCURRENT_ANALYSES)


def _configured_origins() -> list[str]:
    raw = os.getenv("VISION_ALLOWED_ORIGINS", "http://localhost:3000")
    return [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]


def _api_key_is_configured() -> bool:
    return bool(os.getenv("VISION_API_KEY", "").strip())


def require_api_key(provided: str | None) -> None:
    if not REQUIRE_API_KEY:
        return
    configured = os.getenv("VISION_API_KEY", "").strip()
    if not configured:
        raise HTTPException(status_code=503, detail="Vision-service API key is not configured")
    if not provided or not hmac.compare_digest(configured, provided):
        raise HTTPException(status_code=401, detail="Invalid vision-service API key")


def tesseract_status() -> tuple[bool, str | None]:
    try:
        return True, str(pytesseract.get_tesseract_version()).splitlines()[0]
    except TesseractNotFoundError:
        return False, None
    except Exception:
        return False, None


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info(
        "service_start version=%s environment=%s max_upload_mb=%s max_concurrency=%s",
        SERVICE_VERSION,
        SERVICE_ENV,
        MAX_UPLOAD_MB,
        MAX_CONCURRENT_ANALYSES,
    )
    if PRELOAD_MODELS:
        try:
            await run_in_threadpool(capabilities)
            logger.info("vision_models_preloaded")
        except Exception:
            # The service can still provide plate OCR even if an optional model fails.
            logger.exception("vision_model_preload_failed")
    yield
    logger.info("service_stop")


app = FastAPI(
    title="CrediSafe Vision Service",
    version=SERVICE_VERSION,
    description=(
        "Vehicle identity and review-only visible road observations for CrediSafe. "
        "The service never applies penalties or rewards automatically."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_configured_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-CrediSafe-Key", "X-Request-ID"],
    expose_headers=["X-Request-ID", "X-Processing-Time-Ms"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", "").strip()[:80] or uuid.uuid4().hex
    request.state.request_id = request_id
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("unhandled_request_error request_id=%s path=%s", request_id, request.url.path)
        raise
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Processing-Time-Ms"] = str(elapsed_ms)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    logger.info(
        "request_complete request_id=%s method=%s path=%s status=%s duration_ms=%s",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "status": "online",
        "health": "/health",
        "documentation": "/docs",
    }


@app.get("/health")
def health() -> dict[str, Any]:
    cascade_available = not cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_russian_plate_number.xml"
    ).empty()
    tesseract_available, version = tesseract_status()
    service_capabilities = capabilities()
    object_detection_available = bool(service_capabilities["object_detection"]["available"])
    healthy = cascade_available and tesseract_available and (not REQUIRE_API_KEY or _api_key_is_configured())
    return {
        "status": "ok" if healthy else "degraded",
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "environment": SERVICE_ENV,
        "api_key_configured": _api_key_is_configured(),
        "plate_locator": "vehicle-guided-opencv-hybrid" if cascade_available else "unavailable",
        "ocr": "tesseract-multipass" if tesseract_available else "unavailable",
        "tesseract_available": tesseract_available,
        "tesseract_version": version,
        "max_upload_mb": MAX_UPLOAD_MB,
        "max_concurrent_analyses": MAX_CONCURRENT_ANALYSES,
        "behaviour_detection": object_detection_available,
        "capabilities": service_capabilities,
    }


@app.post("/v1/analyze")
async def analyze(
    request: Request,
    video: UploadFile = File(...),
    expected_plate: str | None = Form(default=None),
    trip_id: str | None = Form(default=None),
    x_credisafe_key: str | None = Header(default=None),
) -> dict[str, Any]:
    require_api_key(x_credisafe_key)
    request_id = getattr(request.state, "request_id", uuid.uuid4().hex)

    tesseract_available, _ = tesseract_status()
    if not tesseract_available:
        raise HTTPException(status_code=503, detail="Tesseract OCR is unavailable")

    filename = Path(video.filename or "upload.mp4").name[:180]
    extension = Path(filename).suffix.lower()
    content_type = (video.content_type or "").lower().strip()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported video type. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported video content type: {content_type}")

    normalized_expected_plate = normalize_plate(expected_plate or "") or None
    if normalized_expected_plate and not 7 <= len(normalized_expected_plate) <= 12:
        raise HTTPException(status_code=422, detail="Expected registration number has an invalid format")

    try:
        await asyncio.wait_for(analysis_slots.acquire(), timeout=QUEUE_WAIT_SECONDS)
    except TimeoutError as exc:
        raise HTTPException(
            status_code=429,
            detail="The vision service is processing another video. Please retry shortly.",
            headers={"Retry-After": str(max(1, int(QUEUE_WAIT_SECONDS)))},
        ) from exc

    temp_path: Path | None = None
    size = 0
    started = time.perf_counter()
    try:
        with tempfile.NamedTemporaryFile(prefix="credisafe-", suffix=extension, delete=False) as temp:
            temp_path = Path(temp.name)
            while chunk := await video.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Video exceeds the {MAX_UPLOAD_MB} MB backend upload limit",
                    )
                temp.write(chunk)

        if size < 1024:
            raise HTTPException(status_code=422, detail="The uploaded video is empty or invalid")

        result = await run_in_threadpool(
            analyze_video,
            temp_path,
            expected_plate=normalized_expected_plate,
            sample_interval_seconds=SAMPLE_INTERVAL_SECONDS,
            max_sampled_frames=MAX_SAMPLED_FRAMES,
            include_debug_thumbnail=INCLUDE_EVIDENCE_IMAGES,
        )
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        return {
            "request_id": request_id,
            "trip_id": trip_id,
            "original_filename": filename,
            "file_size_bytes": size,
            "service_processing_ms": elapsed_ms,
            **result,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("video_analysis_failed request_id=%s", request_id)
        detail = f"Video analysis failed: {exc}" if EXPOSE_INTERNAL_ERRORS else "Video analysis failed"
        raise HTTPException(status_code=422, detail=detail) from exc
    finally:
        analysis_slots.release()
        try:
            await video.close()
        finally:
            if temp_path and temp_path.exists():
                try:
                    temp_path.unlink()
                except OSError:
                    logger.warning("temporary_file_cleanup_failed request_id=%s", request_id)
