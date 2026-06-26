"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Gauge, LocateFixed, MapPin, Play, Radio, Route, Square, Zap } from "lucide-react";
import { formatDuration } from "./Formatters";
import { useMvp } from "./MvpProvider";
import { ScoreRing } from "./UI";
import { XpBreakdownCard } from "./XpBreakdown";
import { haversineKm } from "@/lib/mvp/scoring";
import type { GpsPoint, Trip } from "@/lib/mvp/types";

const demoSteps = [
  "Vehicle verified",
  "Trip started",
  "Journey recorded",
  "Safety analysed",
  "XP calculation explained",
  "Reward eligibility checked",
  "Leaderboard recalculated",
];

export function TripRecorder() {
  const { snapshot, busy, simulateTrip, completeGpsTrip } = useMvp();
  const [mode, setMode] = useState<"simulation" | "gps">("simulation");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [pointCount, setPointCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Trip | null>(null);
  const [demoStep, setDemoStep] = useState(-1);
  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<string | null>(null);
  const pointsRef = useRef<GpsPoint[]>([]);
  const demoTimersRef = useRef<number[]>([]);

  const primaryVehicle = snapshot.vehicles.find((vehicle) => vehicle.isPrimary) ?? snapshot.vehicles[0];
  const gpsSupported = typeof navigator === "undefined" ? true : "geolocation" in navigator;

  useEffect(() => () => cleanupGps(), []);
  useEffect(() => () => demoTimersRef.current.forEach(window.clearTimeout), []);

  const qualityLabel = useMemo(() => {
    if (accuracy === null) return "Waiting for GPS";
    if (accuracy <= 15) return "Excellent signal";
    if (accuracy <= 35) return "Good signal";
    if (accuracy <= 75) return "Usable signal";
    return "Weak signal";
  }, [accuracy]);

  async function runSimulation(preset: "safe_city" | "mixed_city") {
    setError(null);
    setResult(null);
    setDemoStep(0);
    demoTimersRef.current.forEach(window.clearTimeout);
    demoTimersRef.current = demoSteps.slice(1).map((_, index) => window.setTimeout(() => setDemoStep(index + 1), 430 * (index + 1)));
    try {
      const trip = await simulateTrip(preset);
      setDemoStep(demoSteps.length);
      setResult(trip);
    } catch (simulationError) {
      setDemoStep(-1);
      setError(simulationError instanceof Error ? simulationError.message : "Simulation could not complete");
    }
  }

  function startGps() {
    setError(null);
    setResult(null);
    if (!gpsSupported) {
      setError("This browser does not provide the Geolocation API.");
      return;
    }
    if (!window.isSecureContext && window.location.hostname !== "localhost") {
      setError("Live GPS requires HTTPS or localhost.");
      return;
    }

    pointsRef.current = [];
    startedAtRef.current = new Date().toISOString();
    setElapsed(0);
    setDistanceKm(0);
    setSpeedKmh(0);
    setAccuracy(null);
    setPointCount(0);
    setRecording(true);

    timerRef.current = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const point: GpsPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: position.timestamp || Date.now(),
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading,
        };
        const previous = pointsRef.current.at(-1);
        if (previous) {
          const distance = haversineKm(previous, point);
          const seconds = (point.timestamp - previous.timestamp) / 1000;
          const calculatedSpeed = seconds > 0 ? (distance / (seconds / 3600)) : 0;
          if (distance <= 2 && calculatedSpeed <= 180) {
            setDistanceKm((value) => value + distance);
            setSpeedKmh(point.speed !== null ? Math.max(0, point.speed * 3.6) : calculatedSpeed);
          }
        }
        pointsRef.current.push(point);
        setAccuracy(point.accuracy);
        setPointCount(pointsRef.current.length);
      },
      (geoError) => {
        const messages: Record<number, string> = {
          1: "Location permission was denied. Enable it in browser settings and try again.",
          2: "Your location is currently unavailable.",
          3: "The GPS request timed out. Move near an open area and retry.",
        };
        setError(messages[geoError.code] ?? geoError.message);
        cleanupGps();
        setRecording(false);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );
  }

  async function stopGps() {
    cleanupGps();
    setRecording(false);
    const points = pointsRef.current;
    if (!startedAtRef.current || points.length < 2) {
      setError("Not enough GPS samples were captured. Keep the trip active a little longer and move before stopping.");
      return;
    }
    try {
      const trip = await completeGpsTrip({
        startedAt: startedAtRef.current,
        endedAt: new Date().toISOString(),
        points,
        vehicleId: primaryVehicle?.id ?? null,
      });
      setResult(trip);
    } catch (gpsError) {
      setError(gpsError instanceof Error ? gpsError.message : "GPS trip could not be saved");
    }
  }

  function cleanupGps() {
    if (watchIdRef.current !== null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(watchIdRef.current);
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    watchIdRef.current = null;
    timerRef.current = null;
  }

  return (
    <div className="mvp-trip-workspace">
      <section className="mvp-trip-control-panel">
        <div className="mvp-mode-switch" role="tablist" aria-label="Trip mode">
          <button className={mode === "simulation" ? "active" : ""} onClick={() => !recording && setMode("simulation")}><Play size={17} /> Presentation simulation</button>
          <button className={mode === "gps" ? "active" : ""} onClick={() => setMode("gps")}><LocateFixed size={17} /> Live browser GPS</button>
        </div>

        {mode === "simulation" ? (
          <div className="mvp-simulation-panel">
            <span className="mvp-panel-kicker"><Zap size={16} /> Reliable team demo</span>
            <h2>Prove the complete product loop in seconds.</h2>
            <p>The trip is clearly labelled as simulated. It previews score and lifetime XP, but does not create spendable reward points.</p>
            <div className="mvp-simulation-presets">
              <button disabled={busy || demoStep >= 0} onClick={() => runSimulation("safe_city")}>
                <ShieldPreset icon={<CheckCircle2 />} title="Safe city trip" detail="8.4 km · 97 score · XP explained" />
              </button>
              <button disabled={busy || demoStep >= 0} onClick={() => runSimulation("mixed_city")}>
                <ShieldPreset icon={<AlertTriangle />} title="Mixed city trip" detail="10.7 km · 88 score · XP explained" />
              </button>
            </div>
            {demoStep >= 0 && (
              <div className="mvp-demo-sequence">
                {demoSteps.map((step, index) => (
                  <div className={index < demoStep ? "done" : index === demoStep ? "active" : ""} key={step}>
                    <i>{index < demoStep ? <CheckCircle2 size={15} /> : index + 1}</i><span>{step}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mvp-gps-panel">
            <span className="mvp-panel-kicker"><Radio size={16} /> Live trip recorder</span>
            <h2>{recording ? "Trip recording is active." : "Turn your phone into the first CrediSafe sensor."}</h2>
            <p>{recording ? "Keep this page open. CrediSafe is collecting only trip coordinates, timestamps and GPS quality until you stop." : "Allow location access, move with the device and stop the trip when the journey ends. HTTPS is required outside localhost."}</p>

            <div className="mvp-live-metrics">
              <div><Gauge /><strong>{Math.round(speedKmh)}</strong><span>km/h</span></div>
              <div><Route /><strong>{distanceKm.toFixed(2)}</strong><span>kilometres</span></div>
              <div><Radio /><strong>{formatDuration(elapsed)}</strong><span>elapsed</span></div>
              <div><MapPin /><strong>{accuracy === null ? "—" : Math.round(accuracy)}</strong><span>metres accuracy</span></div>
            </div>

            <div className="mvp-gps-status">
              <span><i className={recording ? "live" : ""} /> {recording ? "Recording" : "Ready"}</span>
              <span>{qualityLabel}</span>
              <span>{pointCount} samples</span>
            </div>

            {!recording ? (
              <button className="mvp-button primary large" disabled={busy || !gpsSupported} onClick={startGps}><Play size={18} /> Start live trip</button>
            ) : (
              <button className="mvp-button danger large" disabled={busy} onClick={stopGps}><Square size={18} /> Stop and calculate score</button>
            )}
          </div>
        )}

        {error && <div className="mvp-inline-error"><AlertTriangle size={18} /><span>{error}</span></div>}
      </section>

      <aside className="mvp-trip-sidebar">
        <div className="mvp-panel">
          <span className="mvp-panel-kicker">Trip identity</span>
          <h3>{primaryVehicle?.makeModel ?? "No vehicle added"}</h3>
          <div className="mvp-vehicle-number">{primaryVehicle?.registrationNumber ?? "ADD VEHICLE"}</div>
          <p className="mvp-muted">Vehicle verification is simulated until an official data partnership is available.</p>
        </div>

        <div className="mvp-panel mvp-scoring-explainer">
          <span className="mvp-panel-kicker">Transparent XP Engine 2.0</span>
          <h3>How XP is earned</h3>
          <div><span>Eligible trip completion</span><strong>+25</strong></div>
          <div><span>Safety-score reward</span><strong>up to +110</strong></div>
          <div><span>Validated distance</span><strong>2 XP/km</strong></div>
          <div><span>Clean-trip bonus</span><strong>+25</strong></div>
          <div><span>Trusted GPS data</span><strong>up to +15</strong></div>
          <div><span>Daily streak bonus</span><strong>up to +25</strong></div>
          <small>One trip is capped at 220 XP. Real GPS trips convert 50% of awarded XP into spendable reward points; simulations do not.</small>
        </div>
      </aside>

      <AnimatePresence>
        {result && (
          <motion.div className="mvp-result-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="mvp-result-dialog" initial={{ opacity: 0, scale: .94, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .96 }}>
              <button className="mvp-result-close" onClick={() => { setResult(null); setDemoStep(-1); }}>×</button>
              <span className="mvp-panel-kicker"><CheckCircle2 size={16} /> Trip complete</span>
              <ScoreRing score={result.safetyScore} size={142} />
              <h2>Safe journey recorded.</h2>
              <p>Your score, XP and reward-point calculation are shown below—nothing is hidden.</p>
              <div className="mvp-result-stats">
                <div><strong>+{result.xpEarned}</strong><span>Lifetime XP</span></div>
                <div><strong>+{result.rewardPointsEarned}</strong><span>Reward points</span></div>
                <div><strong>{result.distanceKm.toFixed(1)} km</strong><span>Distance</span></div>
              </div>
              <XpBreakdownCard trip={result} />
              <button className="mvp-button primary large" onClick={() => { setResult(null); setDemoStep(-1); }}>Continue to dashboard</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ShieldPreset({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <><i>{icon}</i><span><strong>{title}</strong><small>{detail}</small></span></>;
}
