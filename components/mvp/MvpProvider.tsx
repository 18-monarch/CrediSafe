"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createDefaultSnapshot, seededLeaderboard } from "@/lib/mvp/demo-data";
import { calculateGpsTrip, createSimulatedTrip, levelFromXp, resolveStreak } from "@/lib/mvp/scoring";
import type { GpsPoint, MvpSnapshot, RewardClaim, Trip, Vehicle, VideoAnalysis } from "@/lib/mvp/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const STORAGE_KEY = "credisafe:mvp:v1";

interface AddVehicleInput {
  registrationNumber: string;
  makeModel: string;
  vehicleType: Vehicle["vehicleType"];
  isPrimary: boolean;
}

interface MvpContextValue {
  snapshot: MvpSnapshot;
  ready: boolean;
  busy: boolean;
  message: string | null;
  refresh: () => Promise<void>;
  simulateTrip: (preset?: "safe_city" | "mixed_city") => Promise<Trip>;
  completeGpsTrip: (payload: { startedAt: string; endedAt: string; points: GpsPoint[]; vehicleId?: string | null }) => Promise<Trip>;
  analyzeVideo: (payload: { file: File; tripId?: string | null; vehicleId?: string | null }) => Promise<VideoAnalysis>;
  addVehicle: (input: AddVehicleInput) => Promise<void>;
  claimReward: (rewardId: string) => Promise<void>;
  updateProfile: (input: { fullName: string; city: string }) => Promise<void>;
  resetDemo: () => void;
  clearMessage: () => void;
}

const MvpContext = createContext<MvpContextValue | null>(null);

export function MvpProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<MvpSnapshot>(() => createDefaultSnapshot());
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  const refresh = useCallback(async () => {
    if (!configured) {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Partial<MvpSnapshot>;
          setSnapshot({ ...createDefaultSnapshot(), ...parsed, trips: (parsed.trips ?? []).map(normalizeLegacyTrip), videoAnalyses: (parsed.videoAnalyses ?? []).map(normalizeLegacyVideoAnalysis) });
        } catch {
          setSnapshot(createDefaultSnapshot());
        }
      }
      setReady(true);
      return;
    }

    const response = await fetch("/api/mvp", { cache: "no-store" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? "Could not load CrediSafe data");
    }
    const body = await response.json();
    setSnapshot(body.data as MvpSnapshot);
    setReady(true);
  }, [configured]);

  useEffect(() => {
    refresh().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Could not load CrediSafe");
      setReady(true);
    });
  }, [refresh]);

  useEffect(() => {
    if (!configured && ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }, [configured, ready, snapshot]);

  const run = useCallback(async <T,>(work: () => Promise<T>, successMessage?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await work();
      if (successMessage) setMessage(successMessage);
      return result;
    } catch (error) {
      const text = error instanceof Error ? error.message : "Something went wrong";
      setMessage(text);
      throw error;
    } finally {
      setBusy(false);
    }
  }, []);

  const simulateTrip = useCallback((preset: "safe_city" | "mixed_city" = "safe_city") => run(async () => {
    const vehicleId = snapshot.vehicles.find((vehicle) => vehicle.isPrimary)?.id ?? snapshot.vehicles[0]?.id ?? null;
    if (configured) {
      const response = await fetch("/api/trips/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId, preset }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Simulation failed");
      await refresh();
      return { id: body.data.tripId, ...body.data.result } as Trip;
    }

    const streak = resolveStreak(snapshot.profile.lastTripDate, snapshot.profile.currentStreak, new Date().toISOString());
    const trip: Trip = { id: crypto.randomUUID(), ...createSimulatedTrip(vehicleId, preset, streak.streakDays, streak.firstTripOfDay) };
    setSnapshot((current) => applyLocalTrip(current, trip));
    return trip;
  }, "Safe trip completed and XP explained"), [configured, refresh, run, snapshot.profile.currentStreak, snapshot.profile.lastTripDate, snapshot.vehicles]);

  const completeGpsTrip = useCallback((payload: { startedAt: string; endedAt: string; points: GpsPoint[]; vehicleId?: string | null }) => run(async () => {
    if (configured) {
      const response = await fetch("/api/trips/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not complete GPS trip");
      await refresh();
      return { id: body.data.tripId, ...body.data.result } as Trip;
    }

    const streak = resolveStreak(snapshot.profile.lastTripDate, snapshot.profile.currentStreak, payload.endedAt);
    const trip: Trip = {
      id: crypto.randomUUID(),
      ...calculateGpsTrip({ mode: "gps", ...payload, streakDays: streak.streakDays, firstTripOfDay: streak.firstTripOfDay }),
    };
    setSnapshot((current) => applyLocalTrip(current, trip));
    return trip;
  }, "GPS trip saved, scored and XP explained"), [configured, refresh, run, snapshot.profile.currentStreak, snapshot.profile.lastTripDate]);

  const analyzeVideo = useCallback((payload: { file: File; tripId?: string | null; vehicleId?: string | null }) => run(async () => {
    const vehicleId = payload.vehicleId ?? snapshot.vehicles.find((vehicle) => vehicle.isPrimary)?.id ?? snapshot.vehicles[0]?.id ?? null;
    const vehicle = snapshot.vehicles.find((item) => item.id === vehicleId) ?? null;
    const form = new FormData();
    form.append("video", payload.file);
    if (payload.tripId) form.append("tripId", payload.tripId);
    if (vehicleId) form.append("vehicleId", vehicleId);
    if (vehicle?.registrationNumber) form.append("expectedPlate", vehicle.registrationNumber);

    const response = await fetch("/api/vision/analyze", { method: "POST", body: form });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "Video verification failed");
    const analysis = body.data as VideoAnalysis;

    if (configured) {
      await refresh();
      return analysis;
    }

    setSnapshot((current) => ({
      ...current,
      vehicles: current.vehicles.map((item) =>
        item.id === analysis.vehicleId && analysis.matchedRegisteredPlate
          ? { ...item, verificationStatus: "video_matched" }
          : item,
      ),
      videoAnalyses: [analysis, ...current.videoAnalyses],
    }));
    return analysis;
  }, "Video verification completed"), [configured, refresh, run, snapshot.vehicles]);

  const addVehicle = useCallback((input: AddVehicleInput) => run(async () => {
    if (configured) {
      const response = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not add vehicle");
      await refresh();
      return;
    }

    const vehicle: Vehicle = {
      id: crypto.randomUUID(),
      registrationNumber: input.registrationNumber.toUpperCase(),
      makeModel: input.makeModel,
      vehicleType: input.vehicleType,
      isPrimary: input.isPrimary,
      verificationStatus: "simulated",
      createdAt: new Date().toISOString(),
    };
    setSnapshot((current) => ({
      ...current,
      vehicles: [vehicle, ...current.vehicles.map((item) => input.isPrimary ? { ...item, isPrimary: false } : item)],
    }));
  }, "Vehicle added"), [configured, refresh, run]);

  const claimReward = useCallback((rewardId: string) => run(async () => {
    if (configured) {
      const response = await fetch(`/api/rewards/${rewardId}/claim`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not claim reward");
      await refresh();
      return;
    }

    const reward = snapshot.rewards.find((item) => item.id === rewardId);
    if (!reward) throw new Error("Reward not found");
    if (snapshot.profile.rewardPoints < reward.pointsCost) throw new Error("Not enough reward points yet");
    const claim: RewardClaim = {
      id: crypto.randomUUID(),
      rewardId: reward.id,
      rewardTitle: reward.title,
      pointsSpent: reward.pointsCost,
      voucherCode: `CS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      status: "claimed",
      createdAt: new Date().toISOString(),
    };
    setSnapshot((current) => ({
      ...current,
      profile: { ...current.profile, rewardPoints: current.profile.rewardPoints - reward.pointsCost },
      claims: [claim, ...current.claims],
    }));
  }, "Reward claimed"), [configured, refresh, run]);

  const updateProfile = useCallback((input: { fullName: string; city: string }) => run(async () => {
    if (configured) {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not update profile");
      await refresh();
      return;
    }
    setSnapshot((current) => rebuildLeaderboard({
      ...current,
      profile: { ...current.profile, fullName: input.fullName, city: input.city },
    }));
  }, "Profile updated"), [configured, refresh, run]);

  const resetDemo = useCallback(() => {
    const fresh = createDefaultSnapshot();
    setSnapshot(fresh);
    window.localStorage.removeItem(STORAGE_KEY);
    setMessage("Local data reset");
  }, []);

  const value = useMemo<MvpContextValue>(() => ({
    snapshot,
    ready,
    busy,
    message,
    refresh,
    simulateTrip,
    completeGpsTrip,
    analyzeVideo,
    addVehicle,
    claimReward,
    updateProfile,
    resetDemo,
    clearMessage: () => setMessage(null),
  }), [snapshot, ready, busy, message, refresh, simulateTrip, completeGpsTrip, analyzeVideo, addVehicle, claimReward, updateProfile, resetDemo]);

  return <MvpContext.Provider value={value}>{children}</MvpContext.Provider>;
}

export function useMvp() {
  const context = useContext(MvpContext);
  if (!context) throw new Error("useMvp must be used inside MvpProvider");
  return context;
}

function normalizeLegacyTrip(trip: Trip): Trip {
  const legacy = trip as Trip & Record<string, any>;
  const xpEarned = Number(legacy.xpEarned ?? 0);
  const rewardPointsEarned = Number(legacy.rewardPointsEarned ?? (legacy.mode === "gps" ? Math.floor(xpEarned / 2) : 0));
  return {
    ...trip,
    xpEarned,
    rewardPointsEarned,
    xpBreakdown: legacy.xpBreakdown ?? {
      version: "legacy",
      eligible: xpEarned > 0,
      rewardEligible: legacy.mode === "gps",
      subtotal: xpEarned,
      cap: xpEarned,
      total: xpEarned,
      items: [{ code: "safety", label: "Legacy XP award", points: xpEarned, detail: "This trip was recorded before the transparent XP Engine v2 breakdown." }],
      note: "Legacy trip retained for compatibility.",
    },
  };
}

function normalizeLegacyVideoAnalysis(analysis: VideoAnalysis): VideoAnalysis {
  const anyAnalysis = analysis as VideoAnalysis & Record<string, any>;
  const resultState = anyAnalysis.resultState ?? (anyAnalysis.matchedRegisteredPlate ? "matched" : anyAnalysis.detections?.length ? "mismatch" : "no_plate");
  const emptyCheck = (note: string) => ({ status: "not_analyzed" as const, note });
  return {
    ...analysis,
    resultState,
    detector: {
      plateLocator: anyAnalysis.detector?.plateLocator ?? "opencv-hybrid",
      ocr: anyAnalysis.detector?.ocr ?? "tesseract",
      behaviourModel: anyAnalysis.detector?.behaviourModel ?? null,
      helmetModel: anyAnalysis.detector?.helmetModel ?? null,
    },
    observations: anyAnalysis.observations ?? [],
    evidenceFrames: anyAnalysis.evidenceFrames ?? [],
    compliance: anyAnalysis.compliance ?? {
      vehiclePresence: emptyCheck("Vehicle presence was not analysed in this saved result."),
      helmet: emptyCheck("Helmet status was not analysed in this saved result."),
      phoneUse: emptyCheck("Phone interaction was not analysed in this saved result."),
      trafficSignal: emptyCheck("Traffic signal visibility was not analysed in this saved result."),
      laneDiscipline: emptyCheck("Lane discipline was not analysed in this saved result."),
    },
    capabilities: anyAnalysis.capabilities ?? {},
    summary: {
      uniquePlates: Number(anyAnalysis.summary?.uniquePlates ?? 0),
      rawOcrReads: Number(anyAnalysis.summary?.rawOcrReads ?? 0),
      processingMs: Number(anyAnalysis.summary?.processingMs ?? 0),
      sampledFrames: Number(anyAnalysis.summary?.sampledFrames ?? 0),
      sharpFrames: Number(anyAnalysis.summary?.sharpFrames ?? 0),
      candidateRegions: Number(anyAnalysis.summary?.candidateRegions ?? 0),
      durationSeconds: Number(anyAnalysis.summary?.durationSeconds ?? 0),
      objectsDetected: Number(anyAnalysis.summary?.objectsDetected ?? 0),
      vehicleDetections: Number(anyAnalysis.summary?.vehicleDetections ?? 0),
      personDetections: Number(anyAnalysis.summary?.personDetections ?? 0),
      phoneDetections: Number(anyAnalysis.summary?.phoneDetections ?? 0),
      trafficLightDetections: Number(anyAnalysis.summary?.trafficLightDetections ?? 0),
      helmetDetections: Number(anyAnalysis.summary?.helmetDetections ?? 0),
    },
  };
}

function applyLocalTrip(snapshot: MvpSnapshot, trip: Trip): MvpSnapshot {
  const totalXp = snapshot.profile.totalXp + trip.xpEarned;
  const rewardPoints = snapshot.profile.rewardPoints + trip.rewardPointsEarned;
  const today = trip.endedAt.slice(0, 10);
  const streakState = resolveStreak(snapshot.profile.lastTripDate, snapshot.profile.currentStreak, trip.endedAt);
  const eligible = trip.xpBreakdown.eligible;
  const streak = eligible ? streakState.streakDays : snapshot.profile.currentStreak;

  return rebuildLeaderboard({
    ...snapshot,
    profile: {
      ...snapshot.profile,
      totalXp,
      rewardPoints,
      level: levelFromXp(totalXp),
      currentStreak: streak,
      bestStreak: Math.max(streak, snapshot.profile.bestStreak),
      lastTripDate: eligible ? today : snapshot.profile.lastTripDate,
    },
    trips: [trip, ...snapshot.trips],
  });
}

function rebuildLeaderboard(snapshot: MvpSnapshot): MvpSnapshot {
  const entries = [
    ...seededLeaderboard,
    {
      id: snapshot.profile.id,
      name: snapshot.profile.fullName,
      city: snapshot.profile.city,
      totalXp: snapshot.profile.totalXp,
      level: snapshot.profile.level,
      rank: 0,
      isCurrentUser: true,
    },
  ]
    .sort((a, b) => b.totalXp - a.totalXp)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
  return { ...snapshot, leaderboard: entries };
}
