# Merge Audit

## Received Python project

Files inspected:

- `app.py`
- `index.html`
- `fastag.db`
- `yolov8n.pt`

## What was genuinely functional

- Flask upload API
- OpenCV video sampling
- Haar-cascade plate candidate detection
- Tesseract OCR
- Indian plate-format validation
- SQLite plate totals/history
- Static upload, balance and leaderboard UI

## Critical problems found

1. **Random safety claims** — after reading a plate, the code randomly selected entries such as signal compliance, speed limit, no-phone, seatbelt and lane discipline.
2. **Random rewards** — points were automatically credited for those unverified events.
3. **Unused model file** — `yolov8n.pt` was bundled but not loaded anywhere.
4. **Hard-coded local API URL** — the HTML only called `127.0.0.1:5000`.
5. **No users or trip identity** — SQLite points were attached only to plate strings.
6. **No GPS/video relationship** — footage could not be associated with a specific CrediSafe trip.
7. **No authentication or API protection** — any caller could upload and credit points.
8. **Client-only redemption** — reward redemption reduced only an in-memory JavaScript value and did not persist.

## Decisions made in the merged build

- Next.js remains the main application and user experience.
- Supabase remains the source of truth.
- Python becomes a separate internal vision service.
- The old random compliance/reward logic is not used.
- Video performs registration-plate verification only.
- GPS remains the safety-score source in v1.
- Video evidence can be linked to the same trip and vehicle.
- Short uploads are size-limited, API-key protected and deleted after processing.
- OCR output is stored with timestamps, bounding boxes, read consistency and confidence.
- A `video_matched` vehicle state is separate from official verification.

## Funding-demo claim that is supportable

> CrediSafe records a GPS trip, creates a transparent speed-based safety score, and can process matching road footage through a Python service to verify that the registered vehicle appears in the evidence.

## Claims that are not supportable yet

- automatic helmet detection
- signal-violation detection
- lane-discipline detection
- phone-use detection
- seatbelt detection
- government traffic-camera integration
- official FASTag/VAHAN verification
- real cash or fuel rewards
