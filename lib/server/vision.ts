export function getVisionServiceUrl() {
  const configured = process.env.VISION_SERVICE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return process.env.NODE_ENV === "production" ? null : "http://127.0.0.1:8000";
}

export function getVisionApiKey() {
  return process.env.VISION_API_KEY?.trim() || null;
}

export function getVisionUploadLimitBytes() {
  const mb = Number(process.env.VISION_MAX_UPLOAD_MB ?? 25);
  const safeMb = Number.isFinite(mb) && mb > 0 ? Math.min(mb, 100) : 25;
  return safeMb * 1024 * 1024;
}

export function normalizeRegistration(value: string | null | undefined) {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
