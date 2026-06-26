# Windows Setup

## Run immediately in local demo mode

Open PowerShell inside the extracted project folder:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000` and click **Open working MVP**.

## Connect Supabase

```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local` and add your Supabase project URL and publishable key. Then run the SQL file below in the Supabase SQL editor:

```text
supabase/migrations/202606210001_credisafe_mvp.sql
```

Restart the server:

```powershell
Ctrl + C
npm run dev
```

Create an account at `http://localhost:3000/signup`.

## Validate before deployment

```powershell
npm run check
```


## If npm reports “Exit handler never called”

Use Node.js 20.9 or newer. Then run:

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item package-lock.json -Force -ErrorAction SilentlyContinue
npm cache verify
npm config set registry https://registry.npmjs.org/
npm install
```

---

## Unified GPS + video setup

Install Tesseract OCR for Windows and add its installation folder to PATH. Then:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r vision_service\requirements.txt
Copy-Item .env.example .env.local
```

Use the same secret in `.env.local` and the Python terminal:

```powershell
$env:VISION_API_KEY="replace-with-a-long-random-value"
npm run dev:vision
```

Open a second terminal:

```powershell
npm run dev:web
```

Check:

```text
http://127.0.0.1:8000/health
http://localhost:3000/api/vision/status
http://localhost:3000/app/vision
```
