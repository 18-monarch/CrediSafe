import { seededLeaderboard } from "@/lib/mvp/demo-data";
import { levelFromXp } from "@/lib/mvp/scoring";
import type { LeaderboardEntry, MvpSnapshot } from "@/lib/mvp/types";
import { requireUser } from "@/lib/server/auth";
import { apiError, apiSuccess } from "@/lib/server/http";
import {
  serializeClaim,
  serializeLeaderboard,
  serializeProfile,
  serializeReward,
  serializeTrip,
  serializeVehicle,
  serializeVideoAnalysis,
} from "@/lib/server/serializers";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (auth.error || !auth.supabase || !auth.user) return apiError(auth.error ?? "Unauthorized", auth.status);
  const { supabase, user } = auth;

  let { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) {
    const fallbackName = user.user_metadata?.full_name || user.email?.split("@")[0] || "CrediSafe Driver";
    const created = await supabase
      .from("profiles")
      .upsert({ id: user.id, full_name: fallbackName, city: "India" })
      .select("*")
      .single();
    if (created.error) return apiError("Could not create driver profile", 500, created.error.message);
    profile = created.data;
  }
  if (!profile) return apiError("Could not load driver profile", 500);

  const [vehiclesResult, tripsResult, rewardsResult, claimsResult, profilesResult, analysesResult] = await Promise.all([
    supabase.from("vehicles").select("*").eq("user_id", user.id).order("is_primary", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("trips").select("*").eq("user_id", user.id).order("ended_at", { ascending: false }).limit(30),
    supabase.from("rewards").select("*").eq("active", true).order("points_cost", { ascending: true }),
    supabase.from("reward_claims").select("*, rewards(title)").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, city, total_xp, level").order("total_xp", { ascending: false }).limit(20),
    supabase.from("video_analyses").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
  ]);

  const queryError = vehiclesResult.error ?? tripsResult.error ?? rewardsResult.error ?? claimsResult.error ?? profilesResult.error ?? analysesResult.error;
  if (queryError) return apiError("Could not load the product dashboard", 500, queryError.message);

  const actualEntries = (profilesResult.data ?? []).map((row, index) => serializeLeaderboard(row, user.id, index + 1));
  const actualIds = new Set(actualEntries.map((entry) => entry.id));
  const combined: LeaderboardEntry[] = [
    ...actualEntries,
    ...seededLeaderboard.filter((entry) => !actualIds.has(entry.id)),
  ]
    .sort((a, b) => b.totalXp - a.totalXp)
    .slice(0, 20)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  if (!combined.some((entry) => entry.id === user.id)) {
    const serialized = serializeProfile(profile);
    combined.push({
      id: user.id,
      name: serialized.fullName,
      city: serialized.city,
      totalXp: serialized.totalXp,
      level: levelFromXp(serialized.totalXp),
      rank: combined.length + 1,
      isCurrentUser: true,
    });
  }

  const analysisIds = (analysesResult.data ?? []).map((row) => row.id);
  const detectionsResult = analysisIds.length
    ? await supabase.from("video_plate_detections").select("*").in("analysis_id", analysisIds).order("confidence", { ascending: false })
    : { data: [], error: null };
  if (detectionsResult.error) return apiError("Could not load video-verification evidence", 500, detectionsResult.error.message);
  const detectionsByAnalysis = new Map<string, any[]>();
  for (const detection of detectionsResult.data ?? []) {
    const current = detectionsByAnalysis.get(detection.analysis_id) ?? [];
    current.push(detection);
    detectionsByAnalysis.set(detection.analysis_id, current);
  }

  const snapshot: MvpSnapshot = {
    profile: serializeProfile(profile),
    vehicles: (vehiclesResult.data ?? []).map(serializeVehicle),
    trips: (tripsResult.data ?? []).map(serializeTrip),
    rewards: (rewardsResult.data ?? []).map(serializeReward),
    claims: (claimsResult.data ?? []).map(serializeClaim),
    leaderboard: combined,
    videoAnalyses: (analysesResult.data ?? []).map((row) => serializeVideoAnalysis(row, detectionsByAnalysis.get(row.id) ?? [])),
    backendMode: "supabase",
  };

  return apiSuccess(snapshot);
}
