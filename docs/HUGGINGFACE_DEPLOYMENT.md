# Hugging Face Backend Deployment

CrediSafe remains a single monorepo. `vision_service/` is the only backend source of truth. Hugging Face receives a generated subtree containing that folder at the Space repository root.

## Architecture

```text
GitHub main repository
├── Next.js application ───────────────► Vercel
├── Supabase migrations ───────────────► Supabase
└── vision_service/ ── subtree push ──► Hugging Face Docker Space
```

The frontend and Python service communicate over HTTPS:

```text
Next.js server route
  → POST https://<space-host>.hf.space/v1/analyze
  → X-CrediSafe-Key: shared production secret
  ← structured JSON evidence
  → save analysis metadata in Supabase
```

## 1. Create the Space

Create a Hugging Face Space with:

```text
Name: credisafe-vision
SDK: Docker
Hardware: CPU Basic
Visibility: Public for the simplest Vercel integration
```

A public Space exposes the URL, not the protected analysis endpoint. `/v1/analyze` rejects requests without the private `X-CrediSafe-Key` value.

## 2. Configure secrets and variables

Add `VISION_API_KEY` as a **Secret**. Generate a value locally:

```powershell
$bytes = New-Object byte[] 48
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToHexString($bytes).ToLower()
```

Add the recommended variables from `vision_service/README.md`. Keep `VISION_REQUIRE_API_KEY=true` and `VISION_EXPOSE_INTERNAL_ERRORS=false` in production.

## 3. First deployment

Run from the repository root:

```powershell
.\scripts\deploy-huggingface.ps1 `
  -SpaceUrl "https://huggingface.co/spaces/YOUR_USERNAME/credisafe-vision"
```

The script:

1. confirms the Git working tree is clean;
2. configures the `huggingface` remote;
3. creates a temporary subtree branch from `vision_service/`;
4. pushes that branch to the Space's `main` branch;
5. removes the temporary local branch.

The Space rebuilds automatically after the push.

## 4. Verify

Open:

```text
https://YOUR_USERNAME-credisafe-vision.hf.space/health
```

A ready deployment should report:

```json
{
  "status": "ok",
  "service": "credisafe-vision",
  "tesseract_available": true,
  "behaviour_detection": true,
  "api_key_configured": true
}
```

Free Spaces can suspend after inactivity. The first request after suspension may take longer while the container and models load.

## 5. Connect Vercel

Add server-only Vercel variables:

```env
VISION_SERVICE_URL=https://YOUR_USERNAME-credisafe-vision.hf.space
VISION_API_KEY=the-same-secret-used-by-the-space
VISION_PROXY_MAX_UPLOAD_MB=4
```

Do not use `NEXT_PUBLIC_` for the service URL or secret.

## Future backend updates

Commit the backend change to GitHub first:

```powershell
git add vision_service
git commit -m "Improve CrediSafe vision service"
git push origin main
```

Then deploy the committed subtree:

```powershell
.\scripts\deploy-huggingface.ps1
```

This prevents duplicate source folders and keeps GitHub as the authoritative project history.
