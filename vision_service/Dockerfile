FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=7860 \
    VISION_ENV=production \
    VISION_REQUIRE_API_KEY=true \
    VISION_PRELOAD_MODELS=true \
    HOME=/home/user \
    YOLO_CONFIG_DIR=/home/user/.config/Ultralytics

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        ffmpeg \
        libglib2.0-0 \
        libgl1 \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 1000 user \
    && mkdir -p /home/user/app /home/user/.config/Ultralytics \
    && chown -R user:user /home/user

WORKDIR /home/user/app

COPY requirements.txt ./requirements.txt
RUN python -m pip install --upgrade pip \
    && python -m pip install --no-cache-dir -r requirements.txt

COPY --chown=user:user app ./app
COPY --chown=user:user models ./models

USER user

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD python -c "import json, urllib.request; data=json.load(urllib.request.urlopen('http://127.0.0.1:' + '${PORT:-7860}' + '/health', timeout=8)); raise SystemExit(0 if data.get('status') == 'ok' else 1)"

CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860} --workers 1 --proxy-headers --forwarded-allow-ips='*'"]
