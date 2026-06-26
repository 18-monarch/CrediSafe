# Deployment Notes

## Next.js

Deploy the repository to a Node/Next.js host. Add:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
VISION_SERVICE_URL=https://your-python-service.example
VISION_API_KEY=the-same-secret-used-by-python
VISION_MAX_UPLOAD_MB=25
```

## Python vision service

Build `vision_service/Dockerfile` from the repository root. Set:

```env
VISION_API_KEY=the-same-secret-used-by-nextjs
VISION_MAX_UPLOAD_MB=25
VISION_MAX_SAMPLED_FRAMES=120
```

The container installs Tesseract and deletes each temporary upload after analysis.

## Important MVP limit

The current Next.js route proxies the uploaded file to Python. This is appropriate for controlled short funding-demo clips, but serverless platforms may enforce request-size and execution-time limits.

Before a large public pilot, change the flow to:

```text
browser → private object storage → queued job → Python worker → callback/database
```

That removes serverless upload limits and makes long-running analysis reliable.
