# Unified Architecture

## Components

### Next.js application

Handles the public website, rider UI, GPS collection, score calculation, authentication-aware APIs, rewards and dashboards.

### Python FastAPI vision service

Handles temporary video upload, frame sampling, plate candidate detection, OCR, voting and result generation.

### Supabase

Stores users, vehicles, trips, GPS points, XP, rewards, video analyses and plate detections with row-level security.

## Request path

```text
Browser
  │
  ├── GPS points ──> Next.js scoring API ──> Supabase trips
  │
  └── short video ─> Next.js /api/vision/analyze
                         │ authenticated user/vehicle/trip validation
                         │ server-side API key
                         ▼
                    Python /v1/analyze
                         │ temporary file
                         │ OpenCV + Tesseract
                         ▼
                    structured plate evidence
                         │
                         ▼
                    Supabase video tables
```

## Why the services are separate

Python computer-vision dependencies are large and CPU-oriented. Keeping them outside the Next.js deployment prevents the frontend from becoming slow or fragile and allows the analysis service to scale independently.

## Current score ownership

- GPS engine: safety score and XP
- Vision engine: vehicle/plate evidence
- Supabase: persistence and security
- Next.js: orchestration and presentation

No video detection automatically changes XP in this version.
