# Validation

Validated on 25 June 2026.

## Web application

- `npm ci` — passed
- `npm run typecheck` — passed
- `npm test` — 6/6 passed
- `npm run build` — passed
- 18 application pages generated successfully
- XP Engine 2.0 eligibility, reward conversion, streak and level-progress tests — passed

## Python vision service

- Python compilation — passed
- Plate unit tests — 2/2 passed
- Synthetic Indian plate matching — passed
- Tesseract OCR health check — passed
- Included YOLO model loading — passed
- Car detection on a real video frame — passed
- Evidence-frame generation — passed

## Honest limitations

- A dedicated helmet model is not bundled
- Traffic-light colour observation is not signal-violation detection
- Lane and wrong-side analysis require camera calibration
- Real partner rewards and official vehicle data require external integrations


## Responsive experience validation

- Mobile and tablet composition uses an independent normal document flow
- Desktop cinematic composition remains isolated above 900px
- Portrait video asset: 720 × 1280, 10 seconds, 1.4 MB
- TypeScript check: passed
- Application tests: 6/6 passed
- Next.js production build: passed
