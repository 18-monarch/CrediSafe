import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateGpsTrip,
  calculateXpBreakdown,
  createSimulatedTrip,
  haversineKm,
  levelFromXp,
  levelProgress,
  resolveStreak,
} from "../lib/mvp/scoring";

test("safe-city simulation produces a transparent XP breakdown", () => {
  const trip = createSimulatedTrip(null, "safe_city");
  assert.equal(trip.safetyScore, 97);
  assert.equal(trip.xpEarned, 176);
  assert.equal(trip.rewardPointsEarned, 0);
  assert.equal(trip.xpBreakdown.version, "2.0");
  assert.equal(trip.xpBreakdown.total, 176);
  assert.equal(trip.distanceKm, 8.4);
  assert.equal(trip.mode, "simulation");
});

test("driver levels and in-level progress follow the documented thresholds", () => {
  assert.equal(levelFromXp(0), "Bronze");
  assert.equal(levelFromXp(500), "Silver");
  assert.equal(levelFromXp(1000), "Gold");
  assert.equal(levelFromXp(2000), "Platinum");
  assert.equal(levelFromXp(3500), "Elite");
  assert.equal(levelFromXp(5500), "Legend");
  assert.equal(levelProgress(750).progress, 50);
});

test("haversine distance is geographically reasonable", () => {
  const distance = haversineKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 });
  assert.ok(distance > 110 && distance < 112);
});

test("GPS scoring detects a major overspeed event", () => {
  const startedAt = new Date("2026-06-21T10:00:00.000Z");
  const points = [
    { latitude: 22.3000, longitude: 73.2000, timestamp: startedAt.getTime(), accuracy: 8, speed: 0, heading: 0 },
    { latitude: 22.3000, longitude: 73.2025, timestamp: startedAt.getTime() + 10_000, accuracy: 8, speed: 24, heading: 90 },
    { latitude: 22.3000, longitude: 73.2050, timestamp: startedAt.getTime() + 20_000, accuracy: 8, speed: 24, heading: 90 },
  ];
  const trip = calculateGpsTrip({
    mode: "gps",
    startedAt: startedAt.toISOString(),
    endedAt: new Date(startedAt.getTime() + 20_000).toISOString(),
    points,
  });
  assert.equal(trip.majorOverspeedEvents, 1);
  assert.ok(trip.safetyScore <= 91);
  assert.ok(trip.maximumSpeedKmh >= 86);
  assert.equal(trip.xpEarned, 0, "A 20-second test trip is too short for XP");
});

test("eligible GPS trips separate lifetime XP from spendable reward points", () => {
  const result = calculateXpBreakdown({
    mode: "gps",
    safetyScore: 97,
    distanceKm: 8.4,
    durationSeconds: 900,
    gpsQuality: 0.95,
    overspeedEvents: 0,
    majorOverspeedEvents: 0,
    streakDays: 4,
    firstTripOfDay: true,
  });
  assert.equal(result.xpEarned, 206);
  assert.equal(result.rewardPointsEarned, 103);
  assert.ok(result.xpBreakdown.items.some((item) => item.code === "streak"));
});

test("streak bonus is awarded only on the first trip of a new day", () => {
  const sameDay = resolveStreak("2026-06-25", 4, "2026-06-25T18:00:00.000Z");
  assert.equal(sameDay.streakDays, 4);
  assert.equal(sameDay.firstTripOfDay, false);

  const nextDay = resolveStreak("2026-06-25", 4, "2026-06-26T08:00:00.000Z");
  assert.equal(nextDay.streakDays, 5);
  assert.equal(nextDay.firstTripOfDay, true);
});
