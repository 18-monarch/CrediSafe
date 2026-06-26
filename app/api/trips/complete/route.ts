import { z } from "zod";
import { calculateGpsTrip, resolveStreak } from "@/lib/mvp/scoring";
import { requireUser } from "@/lib/server/auth";
import { apiError, apiSuccess } from "@/lib/server/http";

const pointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timestamp: z.number().positive(),
  accuracy: z.number().positive().max(500),
  speed: z.number().nullable(),
  heading: z.number().nullable(),
});

const bodySchema = z.object({
  vehicleId: z.string().uuid().nullable().optional(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  points: z.array(pointSchema).min(2).max(5000),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return apiError(auth.error ?? "Unauthorized", auth.status);

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return apiError("Invalid GPS trip payload", 422, parsed.error.flatten());

  const { data: profile, error: profileError } = await auth.supabase
    .from("profiles")
    .select("current_streak,last_trip_date")
    .eq("id", auth.user.id)
    .single();
  if (profileError) return apiError("Could not load XP streak state", 500, profileError.message);

  const streak = resolveStreak(profile.last_trip_date, Number(profile.current_streak ?? 0), parsed.data.endedAt);
  const result = calculateGpsTrip({
    mode: "gps",
    vehicleId: parsed.data.vehicleId,
    startedAt: parsed.data.startedAt,
    endedAt: parsed.data.endedAt,
    points: parsed.data.points,
    streakDays: streak.streakDays,
    firstTripOfDay: streak.firstTripOfDay,
  });

  const { data: tripId, error } = await auth.supabase.rpc("record_trip_result", {
    p_vehicle_id: result.vehicleId,
    p_mode: result.mode,
    p_started_at: result.startedAt,
    p_ended_at: result.endedAt,
    p_distance_km: result.distanceKm,
    p_duration_seconds: result.durationSeconds,
    p_average_speed_kmh: result.averageSpeedKmh,
    p_maximum_speed_kmh: result.maximumSpeedKmh,
    p_overspeed_events: result.overspeedEvents,
    p_major_overspeed_events: result.majorOverspeedEvents,
    p_gps_quality: result.gpsQuality,
    p_safety_score: result.safetyScore,
    p_xp_earned: result.xpEarned,
    p_events: result.events,
    p_metadata: {
      pointCount: parsed.data.points.length,
      speedLimitKmh: 60,
      xpVersion: result.xpBreakdown.version,
      xpBreakdown: result.xpBreakdown,
      rewardPointsEarned: result.rewardPointsEarned,
    },
  });

  if (error || !tripId) return apiError("Could not save GPS trip", 500, error?.message);

  const pointRows = parsed.data.points.map((point, index) => ({
    trip_id: tripId,
    user_id: auth.user!.id,
    point_index: index,
    recorded_at: new Date(point.timestamp).toISOString(),
    latitude: point.latitude,
    longitude: point.longitude,
    accuracy_m: point.accuracy,
    speed_kmh: point.speed === null ? null : point.speed * 3.6,
    heading: point.heading,
  }));

  for (let index = 0; index < pointRows.length; index += 500) {
    const { error: pointsError } = await auth.supabase.from("trip_points").insert(pointRows.slice(index, index + 500));
    if (pointsError) return apiError("Trip saved, but GPS points could not be stored", 500, pointsError.message);
  }

  return apiSuccess({ tripId, result }, 201);
}
