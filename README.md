# CrediSafe

CrediSafe combines GPS trip intelligence, vehicle verification, transparent safety scoring, XP, rewards and reviewable video evidence in one Next.js application.

## Core flow

```text
Start trip
→ collect GPS points
→ clean and score journey
→ award XP and reward progress
→ upload matching road footage
→ verify vehicle plate
→ review visible road observations
→ store the combined result
```

## Main functionality

- Cinematic public website using the official CrediSafe logo
- Driver profile and vehicle management
- Live browser GPS trips and guided simulation
- Distance, speed, GPS quality and overspeed analysis
- Transparent XP Engine 2.0 with per-trip breakdown, eligibility rules, anti-gaming caps and separate reward points
- Trip history and leaderboard
- Python FastAPI vision service
- Vehicle-guided plate search and multi-pass Tesseract OCR
- Generic YOLO road-object detection
- Review-only phone-object proximity observations
- Visible traffic-light state estimates
- Optional dedicated helmet-model support
- Evidence frames, confidence and clear result states
- Local mode and Supabase cloud mode

## Important safety rule

Video observations do not automatically reduce scores, remove rewards or punish a driver. Signal and lane violations require calibrated camera geometry. Low-confidence findings require review.

## Quick start

Read [START_HERE.md](START_HERE.md).

XP rules are documented in [XP_ENGINE.md](XP_ENGINE.md).

## Useful commands

```powershell
npm run dev:web
npm run dev:vision
npm run typecheck
npm test
npm run build
python -m unittest discover vision_service/tests
```
