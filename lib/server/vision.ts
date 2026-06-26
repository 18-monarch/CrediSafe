function parseMegabytes(value: string | undefined, fallback: number, maximum: number) {
  const parsed = Number(value);
  const safe = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return Math.min(safe, maximum);
}

export function getVisionServiceUrl() {
  const configured = process.env.VISION_SERVICE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return process.env.NODE_ENV === "production" ? null : "http://127.0.0.1:8000";
}

export function getVisionApiKey() {
  return process.env.VISION_API_KEY?.trim() || null;
}

/**
 * This is the Next.js proxy limit, not the Python service limit. Hosted
 * serverless functions usually accept a much smaller request body than the
 * backend container, so production defaults to short demo clips.
 */
export function getVisionUploadLimitBytes() {
  const configured = process.env.VISION_PROXY_MAX_UPLOAD_MB;
  const fallback = process.env.NODE_ENV === "production"
    ? 4
    : parseMegabytes(process.env.VISION_MAX_UPLOAD_MB, 25, 100);
  return parseMegabytes(configured, fallback, 100) * 1024 * 1024;
}

export function getVisionRequestTimeoutMs() {
  const parsed = Number(process.env.VISION_REQUEST_TIMEOUT_MS ?? 170_000);
  if (!Number.isFinite(parsed)) return 170_000;
  return Math.max(10_000, Math.min(parsed, 175_000));
}

export function normalizeRegistration(value: string | null | undefined) {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
