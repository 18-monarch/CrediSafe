# Backend Setup

## Architecture

- **Next.js App Router:** frontend, protected pages and Route Handlers
- **Supabase Auth:** email/password identity and cookie-based sessions
- **Supabase PostgreSQL:** profiles, vehicles, trips, GPS points, XP, rewards and claims
- **Postgres RPC functions:** atomic trip settlement and reward claiming
- **Row Level Security:** users can access their own private records

## Setup

1. Create a new Supabase project.
2. Run `supabase/migrations/202606210001_credisafe_mvp.sql`.
3. Run `supabase/migrations/202606250002_video_analysis.sql`.
4. Run `supabase/migrations/202606250003_xp_engine_v2.sql`.
5. Copy `.env.example` to `.env.local`.
6. Insert the project URL and publishable key.
7. In Supabase Auth settings, add local and deployed URLs:
   - `http://localhost:3000/auth/callback`
   - `https://your-domain.com/auth/callback`
8. Start the project.

## Database flow

`record_trip_result(...)` performs the important settlement in one database transaction:

- inserts the trip
- calculates the new streak state
- adds lifetime XP
- adds spendable reward points
- updates the level
- writes an XP transaction

`claim_reward(...)` checks the point balance, subtracts points and creates a unique prototype voucher atomically.

## Local demo mode

When environment variables are missing, the product uses browser LocalStorage. This mode is for demonstrations only and is visibly labelled. Adding Supabase variables automatically switches the product to the real backend.

---

## Python vision service

Install Tesseract OCR, create a Python virtual environment, then install:

```powershell
pip install -r vision_service\requirements.txt
```

Add `VISION_SERVICE_URL` and `VISION_API_KEY` to `.env.local`, then start Python with:

```powershell
$env:VISION_API_KEY="your-shared-secret"
npm run dev:vision
```

The web app and Python service must use the same secret.
