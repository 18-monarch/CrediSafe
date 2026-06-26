import type {
  DriverLevel,
  GpsPoint,
  SafetyEvent,
  Trip,
  TripResultInput,
  TripMode,
  XpBreakdown,
  XpBreakdownItem,
} from "./types";

const EARTH_RADIUS_KM = 6371;
const DEFAULT_SPEED_LIMIT_KMH = 60;

export const XP_ENGINE_VERSION = "2.0";
export const XP_PER_TRIP_CAP = 220;
export const MIN_XP_DISTANCE_KM = 0.5;
export const MIN_XP_DURATION_SECONDS = 120;
export const MIN_XP_GPS_QUALITY = 0.35;

const LEVEL_FLOORS: Record<DriverLevel, number> = {
  Bronze: 0,
  Silver: 500,
  Gold: 1000,
  Platinum: 2000,
  Elite: 3500,
  Legend: 5500,
};

const LEVEL_TARGETS: Record<DriverLevel, number> = {
  Bronze: 500,
  Silver: 1000,
  Gold: 2000,
  Platinum: 3500,
  Elite: 5500,
  Legend: 7500,
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function levelFromXp(totalXp: number): DriverLevel {
  if (totalXp >= 5500) return "Legend";
  if (totalXp >= 3500) return "Elite";
  if (totalXp >= 2000) return "Platinum";
  if (totalXp >= 1000) return "Gold";
  if (totalXp >= 500) return "Silver";
  return "Bronze";
}

export function nextLevelTarget(level: DriverLevel) {
  return LEVEL_TARGETS[level];
}

export function levelProgress(totalXp: number) {
  const level = levelFromXp(totalXp);
  const floor = LEVEL_FLOORS[level];
  const target = LEVEL_TARGETS[level];
  const span = Math.max(1, target - floor);
  const progress = clamp(Math.round(((totalXp - floor) / span) * 100), 0, 100);
  return {
    level,
    floor,
    target,
    progress,
    remaining: Math.max(0, target - totalXp),
  };
}

export function resolveStreak(lastTripDate: string | null, currentStreak: number, endedAt: string) {
  const tripDate = dateKey(endedAt);
  if (!lastTripDate) return { streakDays: 1, firstTripOfDay: true };
  if (lastTripDate === tripDate) return { streakDays: Math.max(1, currentStreak), firstTripOfDay: false };

  const previous = new Date(`${lastTripDate}T00:00:00.000Z`);
  const current = new Date(`${tripDate}T00:00:00.000Z`);
  const gapDays = Math.round((current.getTime() - previous.getTime()) / 86_400_000);
  return {
    streakDays: gapDays === 1 ? Math.max(1, currentStreak) + 1 : 1,
    firstTripOfDay: true,
  };
}

export function haversineKm(a: Pick<GpsPoint, "latitude" | "longitude">, b: Pick<GpsPoint, "latitude" | "longitude">) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function normalizeGpsPoints(points: GpsPoint[]) {
  return [...points]
    .filter((point) =>
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      Number.isFinite(point.timestamp) &&
      point.accuracy > 0 &&
      point.accuracy <= 100,
    )
    .sort((a, b) => a.timestamp - b.timestamp)
    .filter((point, index, all) => index === 0 || point.timestamp > all[index - 1].timestamp);
}

function segmentSpeedKmh(previous: GpsPoint, current: GpsPoint) {
  if (current.speed !== null && Number.isFinite(current.speed) && current.speed >= 0 && current.speed <= 55) {
    return current.speed * 3.6;
  }
  const hours = (current.timestamp - previous.timestamp) / 3_600_000;
  if (hours <= 0) return 0;
  return haversineKm(previous, current) / hours;
}

function safetyXp(score: number) {
  if (score >= 95) return 110;
  if (score >= 90) return 90;
  if (score >= 80) return 60;
  if (score >= 70) return 40;
  if (score >= 50) return 20;
  return 5;
}

export function calculateXpBreakdown(input: {
  mode: TripMode;
  safetyScore: number;
  distanceKm: number;
  durationSeconds: number;
  gpsQuality: number;
  overspeedEvents: number;
  majorOverspeedEvents: number;
  streakDays?: number;
  firstTripOfDay?: boolean;
}): { xpEarned: number; rewardPointsEarned: number; xpBreakdown: XpBreakdown } {
  const streakDays = Math.max(1, input.streakDays ?? 1);
  const firstTripOfDay = input.firstTripOfDay ?? true;
  const rewardEligible = input.mode === "gps";

  const eligibilityProblems: string[] = [];
  if (input.mode === "gps" && input.distanceKm < MIN_XP_DISTANCE_KM) eligibilityProblems.push(`Trip must cover at least ${MIN_XP_DISTANCE_KM} km.`);
  if (input.mode === "gps" && input.durationSeconds < MIN_XP_DURATION_SECONDS) eligibilityProblems.push(`Trip must last at least ${Math.round(MIN_XP_DURATION_SECONDS / 60)} minutes.`);
  if (input.mode === "gps" && input.gpsQuality < MIN_XP_GPS_QUALITY) eligibilityProblems.push("GPS confidence is too low for a reliable XP award.");

  if (eligibilityProblems.length > 0) {
    const item: XpBreakdownItem = {
      code: "eligibility",
      label: "Trip eligibility",
      points: 0,
      detail: eligibilityProblems.join(" "),
    };
    return {
      xpEarned: 0,
      rewardPointsEarned: 0,
      xpBreakdown: {
        version: XP_ENGINE_VERSION,
        eligible: false,
        rewardEligible: false,
        subtotal: 0,
        cap: XP_PER_TRIP_CAP,
        total: 0,
        items: [item],
        note: "The trip is saved for review, but no XP or reward points are issued.",
      },
    };
  }

  const items: XpBreakdownItem[] = [];
  items.push({
    code: "completion",
    label: "Valid trip completion",
    points: 25,
    detail: "Awarded for completing an eligible journey.",
  });

  const scorePoints = safetyXp(input.safetyScore);
  items.push({
    code: "safety",
    label: `Safety score ${input.safetyScore}/100`,
    points: scorePoints,
    detail: "The safety score is the largest part of the XP award.",
  });

  const distancePoints = Math.min(50, Math.floor(Math.max(0, input.distanceKm) * 2));
  if (distancePoints > 0) {
    items.push({
      code: "distance",
      label: "Validated distance",
      points: distancePoints,
      detail: `2 XP per kilometre, capped at 50 XP per trip.`,
    });
  }

  const hasOverspeed = input.overspeedEvents + input.majorOverspeedEvents > 0;
  if (!hasOverspeed && input.safetyScore >= 90) {
    items.push({
      code: "clean_trip",
      label: "Clean-trip bonus",
      points: 25,
      detail: "No overspeed event was recorded and the score stayed above 90.",
    });
  }

  if (input.mode === "gps") {
    const qualityPoints = input.gpsQuality >= 0.9 ? 15 : input.gpsQuality >= 0.75 ? 8 : 0;
    if (qualityPoints > 0) {
      items.push({
        code: "gps_quality",
        label: "Trusted GPS data",
        points: qualityPoints,
        detail: `GPS confidence was ${Math.round(input.gpsQuality * 100)}%.`,
      });
    }
  }

  if (firstTripOfDay && streakDays >= 2) {
    const streakPoints = Math.min(25, (streakDays - 1) * 5);
    items.push({
      code: "streak",
      label: `${streakDays}-day safe-driving streak`,
      points: streakPoints,
      detail: "The streak bonus is awarded only once per day and is capped at 25 XP.",
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.points, 0);
  const total = Math.min(XP_PER_TRIP_CAP, subtotal);
  if (subtotal > XP_PER_TRIP_CAP) {
    items.push({
      code: "cap",
      label: "Per-trip XP cap",
      points: XP_PER_TRIP_CAP - subtotal,
      detail: `CrediSafe limits one trip to ${XP_PER_TRIP_CAP} XP to reduce gaming and unfair farming.`,
    });
  }

  const rewardPointsEarned = rewardEligible ? Math.floor(total / 2) : 0;
  const note = input.mode === "simulation"
    ? "Simulation XP demonstrates progression. Simulation trips do not create spendable reward points."
    : `Reward points are separate from XP: this trip converts 50% of awarded XP into ${rewardPointsEarned} spendable points.`;

  return {
    xpEarned: total,
    rewardPointsEarned,
    xpBreakdown: {
      version: XP_ENGINE_VERSION,
      eligible: true,
      rewardEligible,
      subtotal,
      cap: XP_PER_TRIP_CAP,
      total,
      items,
      note,
    },
  };
}

/** Backward-compatible helper retained for older callers. */
export function xpForScore(score: number, hasOverspeed: boolean) {
  return calculateXpBreakdown({
    mode: "simulation",
    safetyScore: score,
    distanceKm: 0,
    durationSeconds: 1,
    gpsQuality: 1,
    overspeedEvents: hasOverspeed ? 1 : 0,
    majorOverspeedEvents: 0,
  }).xpEarned;
}

export function calculateGpsTrip(input: TripResultInput): Omit<Trip, "id"> {
  const points = normalizeGpsPoints(input.points ?? []);
  const start = new Date(input.startedAt);
  const end = new Date(input.endedAt);
  const durationSeconds = Math.max(1, Math.round((end.getTime() - start.getTime()) / 1000));

  let distanceKm = 0;
  let maxSpeedKmh = 0;
  let weightedSpeed = 0;
  let weightedSeconds = 0;
  let minorEvents = 0;
  let majorEvents = 0;
  let lastMinorAt = -Infinity;
  let lastMajorAt = -Infinity;
  const events: SafetyEvent[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const seconds = (current.timestamp - previous.timestamp) / 1000;
    if (seconds <= 0 || seconds > 180) continue;

    const segmentDistance = haversineKm(previous, current);
    const speedKmh = segmentSpeedKmh(previous, current);
    if (!Number.isFinite(speedKmh) || speedKmh > 180 || segmentDistance > 4) continue;

    distanceKm += segmentDistance;
    maxSpeedKmh = Math.max(maxSpeedKmh, speedKmh);
    weightedSpeed += speedKmh * seconds;
    weightedSeconds += seconds;

    const atSeconds = Math.round((current.timestamp - start.getTime()) / 1000);
    if (speedKmh >= DEFAULT_SPEED_LIMIT_KMH + 20 && atSeconds - lastMajorAt >= 12) {
      majorEvents += 1;
      lastMajorAt = atSeconds;
      events.push({
        type: "major_overspeed",
        severity: "high",
        penalty: 9,
        atSeconds,
        detail: `${Math.round(speedKmh)} km/h in a 60 km/h configured zone`,
      });
    } else if (speedKmh >= DEFAULT_SPEED_LIMIT_KMH + 5 && atSeconds - lastMinorAt >= 12) {
      minorEvents += 1;
      lastMinorAt = atSeconds;
      events.push({
        type: "minor_overspeed",
        severity: "medium",
        penalty: 4,
        atSeconds,
        detail: `${Math.round(speedKmh)} km/h in a 60 km/h configured zone`,
      });
    }
  }

  const validPointRatio = points.length === 0 ? 0 : points.length / Math.max(points.length, input.points?.length ?? points.length);
  const averageAccuracy = points.length
    ? points.reduce((sum, point) => sum + point.accuracy, 0) / points.length
    : 100;
  const gpsQuality = clamp(Math.round((validPointRatio * 70 + clamp(1 - averageAccuracy / 100, 0, 1) * 30) * 100) / 100, 0, 1);

  let safetyScore = 100 - minorEvents * 4 - majorEvents * 9;
  if (gpsQuality < 0.45) {
    safetyScore -= 5;
    events.push({
      type: "gps_quality",
      severity: "low",
      penalty: 5,
      atSeconds: durationSeconds,
      detail: "Low GPS confidence reduced the score slightly",
    });
  }
  if (distanceKm < 0.15) safetyScore = Math.min(safetyScore, 85);
  safetyScore = clamp(Math.round(safetyScore), 0, 100);

  const averageSpeedKmh = weightedSeconds > 0 ? weightedSpeed / weightedSeconds : durationSeconds > 0 ? distanceKm / (durationSeconds / 3600) : 0;
  const roundedDistance = round(distanceKm, 2);
  const reward = calculateXpBreakdown({
    mode: "gps",
    safetyScore,
    distanceKm: roundedDistance,
    durationSeconds,
    gpsQuality: round(gpsQuality, 2),
    overspeedEvents: minorEvents,
    majorOverspeedEvents: majorEvents,
    streakDays: input.streakDays,
    firstTripOfDay: input.firstTripOfDay,
  });

  return {
    mode: "gps",
    vehicleId: input.vehicleId ?? null,
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
    distanceKm: roundedDistance,
    durationSeconds,
    averageSpeedKmh: round(averageSpeedKmh, 1),
    maximumSpeedKmh: round(maxSpeedKmh, 1),
    overspeedEvents: minorEvents,
    majorOverspeedEvents: majorEvents,
    gpsQuality: round(gpsQuality, 2),
    safetyScore,
    xpEarned: reward.xpEarned,
    rewardPointsEarned: reward.rewardPointsEarned,
    xpBreakdown: reward.xpBreakdown,
    events,
  };
}

export function createSimulatedTrip(
  vehicleId?: string | null,
  preset: "safe_city" | "mixed_city" = "safe_city",
  streakDays = 1,
  firstTripOfDay = true,
): Omit<Trip, "id"> {
  const end = new Date();
  const durationSeconds = preset === "safe_city" ? 14 * 60 + 18 : 17 * 60 + 42;
  const start = new Date(end.getTime() - durationSeconds * 1000);

  if (preset === "mixed_city") {
    const safetyScore = 88;
    const base = {
      mode: "simulation" as const,
      vehicleId: vehicleId ?? null,
      startedAt: start.toISOString(),
      endedAt: end.toISOString(),
      distanceKm: 10.7,
      durationSeconds,
      averageSpeedKmh: 36.3,
      maximumSpeedKmh: 76,
      overspeedEvents: 2,
      majorOverspeedEvents: 0,
      gpsQuality: 0.96,
      safetyScore,
      events: [
        { type: "minor_overspeed" as const, severity: "medium" as const, penalty: 4, atSeconds: 268, detail: "68 km/h in a 60 km/h configured zone" },
        { type: "minor_overspeed" as const, severity: "medium" as const, penalty: 4, atSeconds: 721, detail: "72 km/h in a 60 km/h configured zone" },
      ],
    };
    const reward = calculateXpBreakdown({ ...base, streakDays, firstTripOfDay });
    return { ...base, xpEarned: reward.xpEarned, rewardPointsEarned: reward.rewardPointsEarned, xpBreakdown: reward.xpBreakdown };
  }

  const base = {
    mode: "simulation" as const,
    vehicleId: vehicleId ?? null,
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
    distanceKm: 8.4,
    durationSeconds,
    averageSpeedKmh: 35.3,
    maximumSpeedKmh: 59,
    overspeedEvents: 0,
    majorOverspeedEvents: 0,
    gpsQuality: 0.98,
    safetyScore: 97,
    events: [] as SafetyEvent[],
  };
  const reward = calculateXpBreakdown({ ...base, streakDays, firstTripOfDay });
  return { ...base, xpEarned: reward.xpEarned, rewardPointsEarned: reward.rewardPointsEarned, xpBreakdown: reward.xpBreakdown };
}

function dateKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function round(value: number, digits: number) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}
