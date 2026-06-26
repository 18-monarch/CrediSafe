import { randomUUID } from "node:crypto";
import { apiError, apiSuccess } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { serializeVideoAnalysis } from "@/lib/server/serializers";
import { getVisionApiKey, getVisionRequestTimeoutMs, getVisionServiceUrl, getVisionUploadLimitBytes, normalizeRegistration } from "@/lib/server/vision";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const allowedMimeTypes = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  "video/x-matroska",
  "application/octet-stream",
]);

function mapDetections(body: any) {
  return (Array.isArray(body?.detections) ? body.detections : []).map((item: any) => ({
    plate: normalizeRegistration(item.plate),
    state_code: item.state_code ?? normalizeRegistration(item.plate).slice(0, 2),
    first_seen_sec: Number(item.first_seen_sec ?? 0),
    last_seen_sec: Number(item.last_seen_sec ?? item.first_seen_sec ?? 0),
    bbox: item.bbox ?? { x1: 0, y1: 0, x2: 0, y2: 0 },
    read_count: Number(item.read_count ?? 0),
    ocr_confidence: Number(item.ocr_confidence ?? 0),
    confidence: Number(item.confidence ?? 0),
    matches_expected_plate: Boolean(item.matches_expected_plate),
    evidence_image: typeof item.evidence_image === "string" ? item.evidence_image : null,
  }));
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && !isSupabaseConfigured()) {
    return apiError("Supabase authentication must be configured before enabling production video uploads.", 503);
  }
  const serviceUrl = getVisionServiceUrl();
  if (!serviceUrl) return apiError("Vision service is not configured. Set VISION_SERVICE_URL.", 503);
  const visionApiKey = getVisionApiKey();
  if (process.env.NODE_ENV === "production" && !visionApiKey) {
    return apiError("Vision service authentication is not configured. Set VISION_API_KEY.", 503);
  }

  const incoming = await request.formData().catch(() => null);
  if (!incoming) return apiError("Invalid multipart request", 400);
  const video = incoming.get("video");
  if (!(video instanceof File)) return apiError("A video file is required", 400);
  if (video.size <= 0) return apiError("The selected video is empty", 400);
  if (video.size > getVisionUploadLimitBytes()) {
    return apiError(`Video is too large. The current upload limit is ${Math.round(getVisionUploadLimitBytes() / 1024 / 1024)} MB.`, 413);
  }
  if (video.type && !allowedMimeTypes.has(video.type)) return apiError(`Unsupported video content type: ${video.type}`, 415);

  const requestedTripId = String(incoming.get("tripId") ?? "").trim() || null;
  const requestedVehicleId = String(incoming.get("vehicleId") ?? "").trim() || null;
  let expectedPlate = normalizeRegistration(String(incoming.get("expectedPlate") ?? "")) || null;
  let tripId = requestedTripId;
  let vehicleId = requestedVehicleId;
  let authContext: Awaited<ReturnType<typeof requireUser>> | null = null;

  if (isSupabaseConfigured()) {
    authContext = await requireUser();
    if (authContext.error || !authContext.supabase || !authContext.user) return apiError(authContext.error ?? "Unauthorized", authContext.status);
    const { supabase, user } = authContext;

    if (vehicleId) {
      const vehicleResult = await supabase.from("vehicles").select("id, registration_number").eq("id", vehicleId).eq("user_id", user.id).maybeSingle();
      if (vehicleResult.error) return apiError("Could not validate the selected vehicle", 500, vehicleResult.error.message);
      if (!vehicleResult.data) return apiError("Selected vehicle was not found", 404);
      expectedPlate = normalizeRegistration(vehicleResult.data.registration_number);
    }

    if (tripId) {
      const tripResult = await supabase.from("trips").select("id, vehicle_id").eq("id", tripId).eq("user_id", user.id).maybeSingle();
      if (tripResult.error) return apiError("Could not validate the selected trip", 500, tripResult.error.message);
      if (!tripResult.data) return apiError("Selected trip was not found", 404);
      vehicleId = tripResult.data.vehicle_id ?? vehicleId;
      if (!expectedPlate && vehicleId) {
        const vehicleResult = await supabase.from("vehicles").select("registration_number").eq("id", vehicleId).eq("user_id", user.id).maybeSingle();
        expectedPlate = normalizeRegistration(vehicleResult.data?.registration_number) || null;
      }
    }
  }

  const serviceForm = new FormData();
  serviceForm.append("video", video, video.name || "trip-video.mp4");
  if (expectedPlate) serviceForm.append("expected_plate", expectedPlate);
  if (tripId) serviceForm.append("trip_id", tripId);

  const requestId = randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getVisionRequestTimeoutMs());
  let body: any;
  try {
    const response = await fetch(`${serviceUrl}/v1/analyze`, {
      method: "POST",
      body: serviceForm,
      signal: controller.signal,
      headers: visionApiKey
        ? { "X-CrediSafe-Key": visionApiKey, "X-Request-ID": requestId }
        : { "X-Request-ID": requestId },
      cache: "no-store",
    });
    body = await response.json().catch(() => null);
    if (!response.ok) return apiError(body?.detail ?? "Vision analysis failed", response.status >= 400 && response.status < 600 ? response.status : 502);
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "Video analysis timed out. Use a shorter clip or increase the service timeout."
      : error instanceof Error ? error.message : "Vision service could not be reached";
    return apiError(message, 502);
  } finally {
    clearTimeout(timeout);
  }

  const detections = mapDetections(body);
  const analysisId = randomUUID();
  const row = {
    id: analysisId,
    trip_id: tripId,
    vehicle_id: vehicleId,
    original_filename: video.name || "trip-video.mp4",
    status: "completed",
    analysis_version: body.analysis_version ?? "vision-fusion-v3",
    expected_plate: expectedPlate,
    matched_registered_plate: Boolean(body.matched_registered_plate),
    matched_plate: body.matched_plate ?? null,
    processing_ms: Number(body.summary?.processing_ms ?? 0),
    warnings: Array.isArray(body.warnings) ? body.warnings : [],
    result: body,
    created_at: new Date().toISOString(),
  };

  if (authContext?.supabase && authContext.user) {
    const { supabase, user } = authContext;
    const insertResult = await supabase.from("video_analyses").insert({
      ...row,
      user_id: user.id,
      completed_at: new Date().toISOString(),
    }).select("*").single();
    if (insertResult.error) return apiError("Analysis completed, but evidence could not be saved", 500, insertResult.error.message);

    const savedId = insertResult.data.id;
    if (detections.length) {
      const detectionResult = await supabase.from("video_plate_detections").insert(detections.map((item: any) => ({
        plate: item.plate,
        state_code: item.state_code,
        first_seen_sec: item.first_seen_sec,
        last_seen_sec: item.last_seen_sec,
        bbox: item.bbox,
        read_count: item.read_count,
        ocr_confidence: item.ocr_confidence,
        confidence: item.confidence,
        matches_expected_plate: item.matches_expected_plate,
        analysis_id: savedId,
        user_id: user.id,
      })));
      if (detectionResult.error) return apiError("Analysis was saved, but plate details could not be stored", 500, detectionResult.error.message);
    }

    if (vehicleId && body.matched_registered_plate) {
      await supabase.from("vehicles").update({ verification_status: "video_matched" }).eq("id", vehicleId).eq("user_id", user.id);
    }

    return apiSuccess(serializeVideoAnalysis(insertResult.data, detections));
  }

  return apiSuccess(serializeVideoAnalysis(row, detections));
}
