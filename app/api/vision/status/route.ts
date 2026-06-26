import { apiSuccess } from "@/lib/server/http";
import { getVisionApiKey, getVisionServiceUrl } from "@/lib/server/vision";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const url = getVisionServiceUrl();
  if (!url) return apiSuccess({ configured: false, available: false, message: "VISION_SERVICE_URL is not configured" });

  const controller = new AbortController();
  // A suspended free container can need time to wake and load the bundled model.
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const apiKey = getVisionApiKey();
    const response = await fetch(`${url}/health`, {
      cache: "no-store",
      signal: controller.signal,
      headers: apiKey ? { "X-CrediSafe-Key": apiKey } : undefined,
    });
    const body = await response.json().catch(() => ({}));
    const available = response.ok && body?.status === "ok";
    return apiSuccess({
      configured: true,
      available,
      ...(process.env.NODE_ENV === "development" ? { serviceUrl: url } : {}),
      health: body,
      message: available ? "Vision service is ready" : "Vision service needs attention",
    });
  } catch (error) {
    return apiSuccess({
      configured: true,
      available: false,
      ...(process.env.NODE_ENV === "development" ? { serviceUrl: url } : {}),
      message: error instanceof Error && error.name === "AbortError"
        ? "Vision service is waking up or unavailable"
        : error instanceof Error ? error.message : "Vision service is unavailable",
    });
  } finally {
    clearTimeout(timeout);
  }
}
