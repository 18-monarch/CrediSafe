"use client";

import Link from "next/link";
import { Award, Camera, CarFront, Gauge, Route, ShieldCheck, Sparkles, Trophy, Zap } from "lucide-react";
import { formatDate, formatDuration } from "@/components/mvp/Formatters";
import { useMvp } from "@/components/mvp/MvpProvider";
import { LoadingState, MetricCard, PageHeader, ScoreRing } from "@/components/mvp/UI";
import { XpBreakdownCard } from "@/components/mvp/XpBreakdown";
import { levelProgress } from "@/lib/mvp/scoring";

export default function DashboardPage() {
  const { snapshot, ready } = useMvp();
  if (!ready) return <LoadingState />;

  const latest = snapshot.trips[0];
  const latestAnalysis = snapshot.videoAnalyses[0];
  const levelState = levelProgress(snapshot.profile.totalXp);
  const rank = snapshot.leaderboard.find((entry) => entry.isCurrentUser)?.rank ?? snapshot.leaderboard.length;

  return (
    <>
      <PageHeader
        eyebrow="Driver dashboard"
        title={`Welcome back, ${snapshot.profile.fullName.split(" ")[0]}.`}
        description="Your safe-driving progress, rewards and latest journey—all in one clear view."
        action={<Link className="mvp-button primary" href="/app/trip"><Gauge size={18} /> Start a trip</Link>}
      />

      <section className="mvp-metrics-grid">
        <MetricCard label="Safety score" value={latest ? `${latest.safetyScore}/100` : "—"} detail={latest ? "Latest completed trip" : "Complete your first trip"} icon={<ShieldCheck size={22} />} tone="green" />
        <MetricCard label="Lifetime XP" value={snapshot.profile.totalXp.toLocaleString("en-IN")} detail={`${snapshot.profile.level} driver`} icon={<Zap size={22} />} tone="blue" />
        <MetricCard label="Reward points" value={snapshot.profile.rewardPoints.toLocaleString("en-IN")} detail="Available to redeem" icon={<Award size={22} />} tone="gold" />
        <MetricCard label="City rank" value={`#${rank}`} detail={`${snapshot.profile.currentStreak}-trip safe streak`} icon={<Trophy size={22} />} />
      </section>

      <section className="mvp-dashboard-grid">
        <article className="mvp-panel mvp-hero-panel">
          <div className="mvp-panel-copy">
            <span className="mvp-panel-kicker"><Sparkles size={16} /> Complete product loop</span>
            <h2>One safe journey creates visible progress.</h2>
            <p>Record a real GPS trip, then attach road footage. CrediSafe calculates the journey score and the Python layer verifies visible registration-plate evidence for the same vehicle.</p>
            <div className="mvp-button-row">
              <Link className="mvp-button primary" href="/app/trip">Start journey</Link>
              <Link className="mvp-button secondary" href="/app/trips">View history</Link>
              <Link className="mvp-button secondary" href="/app/vision"><Camera size={17} /> Verify video</Link>
            </div>
          </div>
          <div className="mvp-score-hero">
            <ScoreRing score={latest?.safetyScore ?? 97} size={148} />
            <strong>{latest ? `+${latest.xpEarned} XP` : "Ready to drive"}</strong>
            <span>{latest ? "Awarded on latest trip" : "Run your first trip"}</span>
          </div>
        </article>

        <article className="mvp-panel mvp-level-panel">
          <div className="mvp-panel-title"><div><span>Level progress</span><h3>{snapshot.profile.level} Driver</h3></div><Zap size={22} /></div>
          <div className="mvp-progress-meta"><span>{snapshot.profile.totalXp.toLocaleString("en-IN")} XP</span><span>{levelState.target.toLocaleString("en-IN")} XP target</span></div>
          <div className="mvp-progress"><i style={{ width: `${levelState.progress}%` }} /></div>
          <p>{levelState.remaining.toLocaleString("en-IN")} XP until the next level.</p>
        </article>


        {latest && (
          <article className="mvp-panel mvp-xp-dashboard-panel">
            <XpBreakdownCard trip={latest} compact />
          </article>
        )}

        <article className="mvp-panel mvp-latest-panel">
          <div className="mvp-panel-title"><div><span>Latest journey</span><h3>{latest ? formatDate(latest.endedAt) : "No trip recorded"}</h3></div><Route size={22} /></div>
          {latest ? (
            <div className="mvp-trip-summary">
              <div><strong>{latest.distanceKm.toFixed(1)} km</strong><span>Distance</span></div>
              <div><strong>{formatDuration(latest.durationSeconds)}</strong><span>Duration</span></div>
              <div><strong>{latest.maximumSpeedKmh.toFixed(0)} km/h</strong><span>Maximum</span></div>
              <div><strong>{latest.mode === "gps" ? "Live GPS" : "Simulation"}</strong><span>Trip mode</span></div>
            </div>
          ) : <p className="mvp-muted">Your latest trip metrics will appear here.</p>}
        </article>

        <article className="mvp-panel mvp-vehicle-panel">
          <div className="mvp-panel-title"><div><span>Primary vehicle</span><h3>{snapshot.vehicles.find((vehicle) => vehicle.isPrimary)?.makeModel ?? "Add a vehicle"}</h3></div><CarFront size={22} /></div>
          <div className="mvp-vehicle-number">{snapshot.vehicles.find((vehicle) => vehicle.isPrimary)?.registrationNumber ?? "NOT SET"}</div>
          <div className="mvp-status-list">
            <span><i className="on" /> Driver profile ready</span>
            <span><i className="on" /> GPS trip engine ready</span>
            <span><i className={latestAnalysis?.matchedRegisteredPlate ? "on" : "sim"} /> {latestAnalysis?.matchedRegisteredPlate ? "Vehicle plate matched by video" : "Python video verification ready"}</span>
            <span><i className="sim" /> FASTag integration simulated</span>
          </div>
          <Link className="mvp-text-link" href="/app/profile">Manage profile and vehicle →</Link>
        </article>
      </section>
    </>
  );
}
