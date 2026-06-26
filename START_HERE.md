# CrediSafe — Local Setup

## Requirements

- Node.js 20 LTS or newer
- Python 3.11 or 3.12
- Tesseract OCR installed and available in `PATH`

Check:

```powershell
node -v
npm -v
python --version
tesseract --version
```

## 1. Install the web app

```powershell
npm install
```

## 2. Install the vision service

```powershell
python -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r vision_service\requirements.txt
```

## 3. Configure local environment

```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
VISION_SERVICE_URL=http://127.0.0.1:8000
VISION_API_KEY=credisafe-local-secret
VISION_MAX_UPLOAD_MB=25
```

Leaving Supabase values empty starts CrediSafe in local mode.

## 4. Start both services

Terminal 1:

```powershell
.\.venv\Scripts\Activate.ps1
npm run dev:vision
```

Terminal 2:

```powershell
npm run dev:web
```

Open:

```text
http://localhost:3000
```

Vision health:

```text
http://127.0.0.1:8000/health
```

## Video analysis

Open `/app/vision`, select a vehicle, optionally select a GPS trip, upload a short video and run analysis.

Best plate results require a close, stable, well-lit vehicle view. General road footage can still produce vehicle, person, phone-object and traffic-light observations.

Helmet analysis requires a dedicated compatible model configured with `VISION_HELMET_MODEL_PATH`.


## Supabase upgrade

For an existing Supabase project, run `supabase/migrations/202606250003_xp_engine_v2.sql` after the earlier migrations. This separates lifetime XP from spendable reward points and stores the full XP breakdown.
