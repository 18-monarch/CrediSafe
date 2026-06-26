from __future__ import annotations

import hmac
import os
import tempfile
from pathlib import Path

import cv2
import pytesseract
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pytesseract import TesseractNotFoundError
from dotenv import load_dotenv

from .plate import analyze_video
from .scene import capabilities

# Reuse the same local configuration as the Next.js app.
load_dotenv(Path.cwd() / ".env.local")
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

SERVICE_VERSION = "3.0.0"
MAX_UPLOAD_MB = int(os.getenv("VISION_MAX_UPLOAD_MB", "25"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
ALLOWED_EXTENSIONS = {".mp4", ".mov", ".m4v", ".avi", ".webm", ".mkv"}

app = FastAPI(
    title="CrediSafe Vision Service",
    version=SERVICE_VERSION,
    description="Vehicle identity and visible road-observation service for CrediSafe.",
)

allowed_origins = [item.strip() for item in os.getenv("VISION_ALLOWED_ORIGINS", "http://localhost:3000").split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def require_api_key(provided: str | None) -> None:
    configured = os.getenv("VISION_API_KEY", "").strip()
    if configured and (not provided or not hmac.compare_digest(configured, provided)):
        raise HTTPException(status_code=401, detail="Invalid vision-service API key")


def tesseract_status() -> tuple[bool, str | None]:
    try:
        return True, str(pytesseract.get_tesseract_version()).splitlines()[0]
    except TesseractNotFoundError:
        return False, None
    except Exception:
        return False, None


@app.get("/health")
def health() -> dict:
    cascade_available = not cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_russian_plate_number.xml").empty()
    tesseract_available, version = tesseract_status()
    service_capabilities = capabilities()
    healthy = cascade_available and tesseract_available
    return {
        "status": "ok" if healthy else "degraded",
        "service": "credisafe-vision",
        "version": SERVICE_VERSION,
        "plate_locator": "vehicle-guided-opencv-hybrid" if cascade_available else "unavailable",
        "ocr": "tesseract-multipass" if tesseract_available else "unavailable",
        "tesseract_available": tesseract_available,
        "tesseract_version": version,
        "max_upload_mb": MAX_UPLOAD_MB,
        "behaviour_detection": service_capabilities["object_detection"]["available"],
        "capabilities": service_capabilities,
    }


@app.post("/v1/analyze")
async def analyze(
    video: UploadFile = File(...),
    expected_plate: str | None = Form(default=None),
    trip_id: str | None = Form(default=None),
    x_credisafe_key: str | None = Header(default=None),
) -> dict:
    require_api_key(x_credisafe_key)
    tesseract_available, _ = tesseract_status()
    if not tesseract_available:
        raise HTTPException(status_code=503, detail="Tesseract OCR is not installed or is not available in PATH")

    filename = Path(video.filename or "upload.mp4").name
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail=f"Unsupported video type. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

    temp_path: Path | None = None
    size = 0
    try:
        with tempfile.NamedTemporaryFile(prefix="credisafe-", suffix=extension, delete=False) as temp:
            temp_path = Path(temp.name)
            while chunk := await video.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail=f"Video exceeds the {MAX_UPLOAD_MB} MB upload limit")
                temp.write(chunk)

        result = analyze_video(
            temp_path,
            expected_plate=expected_plate,
            sample_interval_seconds=float(os.getenv("VISION_SAMPLE_INTERVAL_SECONDS", "0.4")),
            max_sampled_frames=int(os.getenv("VISION_MAX_SAMPLED_FRAMES", "180")),
            include_debug_thumbnail=True,
        )
        return {
            "trip_id": trip_id,
            "original_filename": filename,
            "file_size_bytes": size,
            **result,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Video analysis failed: {exc}") from exc
    finally:
        await video.close()
        if temp_path and temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass
