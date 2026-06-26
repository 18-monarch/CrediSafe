---
title: CrediSafe Vision
emoji: 🚗
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# CrediSafe Vision Service

The production-facing Python service for CrediSafe. It combines plate OCR with review-only road-scene observations and returns structured evidence to the Next.js application.

## Verified capabilities

- Samples short uploaded road or vehicle clips with OpenCV.
- Locates plate-shaped regions and reads Indian registration numbers with multipass Tesseract OCR.
- Combines repeated reads across frames and compares the result with the registered vehicle.
- Uses the bundled `models/yolov8n.pt` COCO model for general objects such as vehicles, people, traffic lights and phones.
- Produces review evidence and transparent confidence values.
- Deletes the temporary uploaded file after every request.

## Deliberate boundaries

- Phone proximity and traffic-light colour are observations for human review, not automatic violations.
- Red-light compliance, wrong-side driving and lane discipline require calibrated camera geometry and are not inferred from arbitrary uploads.
- Helmet detection remains disabled until a validated dedicated helmet model is configured.
- This service never awards XP, removes XP or issues penalties. CrediSafe's GPS and database settlement logic remains authoritative.

## API

| Method | Endpoint | Purpose | Authentication |
|---|---|---|---|
| `GET` | `/` | Service metadata | Public |
| `GET` | `/health` | Runtime and capability health | Public |
| `GET` | `/docs` | OpenAPI documentation | Public |
| `POST` | `/v1/analyze` | Analyse a short video clip | `X-CrediSafe-Key` |

`POST /v1/analyze` accepts multipart form fields:

- `video` — required video file
- `expected_plate` — optional registered number
- `trip_id` — optional CrediSafe trip identifier

## Required hosted secret

Add this in the hosting platform's secret manager:

```env
VISION_API_KEY=use-a-long-random-production-secret
```

Use the exact same value in Vercel as a server-only variable. Never prefix it with `NEXT_PUBLIC_`.

## Recommended Hugging Face Space variables

```env
VISION_ENV=production
VISION_REQUIRE_API_KEY=true
VISION_ALLOWED_ORIGINS=https://your-vercel-domain.vercel.app
VISION_MAX_UPLOAD_MB=25
VISION_SAMPLE_INTERVAL_SECONDS=0.4
VISION_MAX_SAMPLED_FRAMES=120
VISION_MAX_CONCURRENT_ANALYSES=1
VISION_QUEUE_WAIT_SECONDS=3
VISION_INCLUDE_EVIDENCE_IMAGES=true
VISION_PRELOAD_MODELS=true
VISION_EXPOSE_INTERNAL_ERRORS=false
VISION_MAX_CANDIDATES_PER_FRAME=3
VISION_MIN_FRAME_SHARPNESS=18
VISION_OCR_TIMEOUT_SECONDS=2.5
```

The default bundled object-model path is resolved automatically. Do not set `VISION_OBJECT_MODEL_PATH` unless replacing the bundled model.

## Local development from the monorepo

From the CrediSafe repository root:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r vision_service\requirements.txt
$env:VISION_API_KEY="credisafe-local-secret"
npm run dev:vision
```

Health check:

```text
http://127.0.0.1:8000/health
```

## Docker from the backend folder

```powershell
docker build -t credisafe-vision .\vision_service
docker run --rm -p 7860:7860 `
  -e VISION_API_KEY="replace-with-a-long-secret" `
  credisafe-vision
```

## Persistence

The container filesystem is temporary. Videos are processed and deleted locally; users, trips, XP, rewards and analysis records belong in Supabase.
