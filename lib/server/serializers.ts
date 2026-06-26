import type { DriverProfile, LeaderboardEntry, PlateDetection, Reward, RewardClaim, Trip, Vehicle, VideoAnalysis } from "@/lib/mvp/types";
import { levelFromXp } from "@/lib/mvp/scoring";

export function serializeProfile(row: any): DriverProfile {
  const totalXp = Number(row.total_xp ?? 0);
  return {
    id: row.id,
    fullName: row.full_name || "CrediSafe Driver",
    city: row.city || "India",
    totalXp,
    rewardPoints: Number(row.reward_points ?? 0),
    level: row.level || levelFromXp(totalXp),
    currentStreak: Number(row.current_streak ?? 0),
    bestStreak: Number(row.best_streak ?? 0),
    lastTripDate: row.last_trip_date ?? null,
  };
}

export function serializeVehicle(row: any): Vehicle {
  return {
    id: row.id,
    registrationNumber: row.registration_number,
    makeModel: row.make_model,
    vehicleType: row.vehicle_type,
    isPrimary: Boolean(row.is_primary),
    verificationStatus: row.verification_status,
    createdAt: row.created_at,
  };
}

export function serializeTrip(row: any): Trip {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const xpEarned = Number(row.xp_earned ?? 0);
  const rewardPointsEarned = Number(metadata.rewardPointsEarned ?? (row.mode === "gps" ? Math.floor(xpEarned / 2) : 0));
  const xpBreakdown = metadata.xpBreakdown ?? {
    version: "legacy",
    eligible: xpEarned > 0,
    rewardEligible: row.mode === "gps",
    subtotal: xpEarned,
    cap: xpEarned,
    total: xpEarned,
    items: [{ code: "safety", label: "Legacy XP award", points: xpEarned, detail: "This trip was recorded before XP Engine v2." }],
    note: "Legacy trip retained for compatibility.",
  };

  return {
    id: row.id,
    mode: row.mode,
    vehicleId: row.vehicle_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    distanceKm: Number(row.distance_km ?? 0),
    durationSeconds: Number(row.duration_seconds ?? 0),
    averageSpeedKmh: Number(row.average_speed_kmh ?? 0),
    maximumSpeedKmh: Number(row.maximum_speed_kmh ?? 0),
    overspeedEvents: Number(row.overspeed_events ?? 0),
    majorOverspeedEvents: Number(row.major_overspeed_events ?? 0),
    gpsQuality: Number(row.gps_quality ?? 0),
    safetyScore: Number(row.safety_score ?? 0),
    xpEarned,
    rewardPointsEarned,
    xpBreakdown,
    events: Array.isArray(row.events) ? row.events : [],
  };
}

export function serializeReward(row: any): Reward {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    rewardType: row.reward_type,
    pointsCost: Number(row.points_cost),
    partnerName: row.partner_name,
    simulated: Boolean(row.simulated),
  };
}

export function serializeClaim(row: any): RewardClaim {
  return {
    id: row.id,
    rewardId: row.reward_id,
    rewardTitle: row.rewards?.title ?? "Reward",
    pointsSpent: Number(row.points_spent),
    voucherCode: row.voucher_code,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function serializeLeaderboard(row: any, currentUserId: string, rank: number): LeaderboardEntry {
  const totalXp = Number(row.total_xp ?? 0);
  return {
    id: row.id,
    name: row.full_name || "CrediSafe Driver",
    city: row.city || "India",
    totalXp,
    level: row.level || levelFromXp(totalXp),
    rank,
    isCurrentUser: row.id === currentUserId,
  };
}


export function serializeVideoAnalysis(row: any, detections: any[] = []): VideoAnalysis {
  const result = row.result && typeof row.result === "object" ? row.result : {};
  const detector = result.detector && typeof result.detector === "object" ? result.detector : {};
  const video = result.video && typeof result.video === "object" ? result.video : {};
  const summary = result.summary && typeof result.summary === "object" ? result.summary : {};
  const compliance = result.compliance && typeof result.compliance === "object" ? result.compliance : {};
  const mappedDetections: PlateDetection[] = detections.map((item) => ({
    plate: item.plate,
    stateCode: item.state_code ?? item.plate?.slice(0, 2) ?? "",
    firstSeenSec: Number(item.first_seen_sec ?? 0),
    lastSeenSec: Number(item.last_seen_sec ?? item.first_seen_sec ?? 0),
    bbox: item.bbox ?? { x1: 0, y1: 0, x2: 0, y2: 0 },
    readCount: Number(item.read_count ?? 0),
    ocrConfidence: Number(item.ocr_confidence ?? 0),
    confidence: Number(item.confidence ?? 0),
    matchesExpectedPlate: Boolean(item.matches_expected_plate),
    evidenceImage: item.evidence_image ?? null,
  }));

  const mapCheck = (value: any, fallbackNote: string) => ({
    status: ["observed", "review_required", "not_detected", "not_analyzed"].includes(value?.status)
      ? value.status
      : "not_analyzed",
    confidence: value?.confidence === undefined ? undefined : Number(value.confidence),
    note: String(value?.note ?? fallbackNote),
  });

  return {
    id: row.id,
    tripId: row.trip_id ?? null,
    vehicleId: row.vehicle_id ?? null,
    originalFilename: row.original_filename ?? "video",
    status: row.status === "failed" ? "failed" : "completed",
    analysisVersion: row.analysis_version ?? result.analysis_version ?? "vision-fusion-v3",
    resultState: ["matched", "mismatch", "plate_detected", "low_confidence", "unreadable", "no_plate"].includes(result.result_state)
      ? result.result_state
      : Boolean(row.matched_registered_plate ?? result.matched_registered_plate) ? "matched" : mappedDetections.length ? "mismatch" : "no_plate",
    detector: {
      plateLocator: detector.plate_locator ?? "vehicle-guided-opencv-hybrid",
      ocr: detector.ocr ?? "tesseract-multipass",
      behaviourModel: detector.behaviour_model ?? null,
      helmetModel: detector.helmet_model ?? null,
    },
    expectedPlate: row.expected_plate ?? result.expected_plate ?? null,
    matchedRegisteredPlate: Boolean(row.matched_registered_plate ?? result.matched_registered_plate),
    matchedPlate: row.matched_plate ?? result.matched_plate ?? null,
    detections: mappedDetections,
    observations: (Array.isArray(result.observations) ? result.observations : []).map((item: any) => ({
      type: String(item.type ?? "observation"),
      label: String(item.label ?? "Observation"),
      status: ["observed", "review_required", "not_detected", "not_analyzed"].includes(item.status) ? item.status : "review_required",
      confidence: Number(item.confidence ?? 0),
      firstSeenSec: Number(item.first_seen_sec ?? 0),
      lastSeenSec: Number(item.last_seen_sec ?? item.first_seen_sec ?? 0),
      occurrences: Number(item.occurrences ?? 1),
      bbox: item.bbox ?? { x1: 0, y1: 0, x2: 0, y2: 0 },
      source: String(item.source ?? "vision-service"),
      reviewRequired: Boolean(item.review_required ?? item.status === "review_required"),
      note: String(item.note ?? "Review the original footage before taking action."),
    })),
    evidenceFrames: (Array.isArray(result.evidence_frames) ? result.evidence_frames : []).map((item: any) => ({
      kind: item.kind ?? "scene",
      title: String(item.title ?? "Evidence frame"),
      timestampSec: Number(item.timestamp_sec ?? 0),
      confidence: Number(item.confidence ?? 0),
      imageDataUrl: String(item.image_data_url ?? ""),
    })).filter((item: any) => item.imageDataUrl.startsWith("data:image/")),
    compliance: {
      vehiclePresence: mapCheck(compliance.vehicle_presence, "Vehicle presence was not analysed."),
      helmet: mapCheck(compliance.helmet, "Helmet status was not analysed."),
      phoneUse: mapCheck(compliance.phone_use, "Phone interaction was not analysed."),
      trafficSignal: mapCheck(compliance.traffic_signal, "Traffic signal visibility was not analysed."),
      laneDiscipline: mapCheck(compliance.lane_discipline, "Lane discipline was not analysed."),
    },
    capabilities: result.capabilities && typeof result.capabilities === "object" ? result.capabilities : {},
    summary: {
      uniquePlates: Number(summary.unique_plates ?? mappedDetections.length),
      rawOcrReads: Number(summary.raw_ocr_reads ?? 0),
      processingMs: Number(row.processing_ms ?? summary.processing_ms ?? 0),
      sampledFrames: Number(video.sampled_frames ?? 0),
      sharpFrames: Number(video.sharp_frames ?? 0),
      candidateRegions: Number(video.candidate_regions ?? 0),
      durationSeconds: Number(video.duration_seconds ?? 0),
      objectsDetected: Number(summary.objects_detected ?? 0),
      vehicleDetections: Number(summary.vehicle_detections ?? 0),
      personDetections: Number(summary.person_detections ?? 0),
      phoneDetections: Number(summary.phone_detections ?? 0),
      trafficLightDetections: Number(summary.traffic_light_detections ?? 0),
      helmetDetections: Number(summary.helmet_detections ?? 0),
    },
    warnings: Array.isArray(row.warnings) ? row.warnings : Array.isArray(result.warnings) ? result.warnings : [],
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}
