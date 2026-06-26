import { apiSuccess } from "@/lib/server/http";
import { getVisionApiKey, getVisionServiceUrl } from "@/lib/server/vision";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const url = getVisionServiceUrl();
  if (!url) return apiSuccess({ configured: false, available: false, message: "VISION_SERVICE_URL is not configured" });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${url}/health`, {
      cache: "no-store",
      signal: controller.signal,
      headers: getVisionApiKey() ? { "X-CrediSafe-Key": getVisionApiKey()! } : undefined,
    });
    const body = await response.json().catch(() => ({}));
    const available = response.ok && body?.status === "ok";
    return apiSuccess({
      configured: true,
      available,
      serviceUrl: url,
      health: body,
      message: available ? "Vision service is ready" : "Vision service needs attention",
    });
  } catch (error) {
    return apiSuccess({
      configured: true,
      available: false,
      serviceUrl: url,
      message: error instanceof Error ? error.message : "Vision service is unavailable",
    });
  } finally {
    clearTimeout(timeout);
  }
}
