"use client";

import Link from "next/link";
import { Camera, CheckCircle2, Gauge, MapPin, Route, ShieldCheck } from "lucide-react";
import { formatDate, formatDuration } from "@/components/mvp/Formatters";
import { useMvp } from "@/components/mvp/MvpProvider";
import { EmptyState, LoadingState, PageHeader, ScoreRing } from "@/components/mvp/UI";
import { XpBreakdownCard } from "@/components/mvp/XpBreakdown";

export default function TripsPage() {
  const { snapshot, ready } = useMvp();
  if (!ready) return <LoadingState />;

  return (
    <>
      <PageHeader
        eyebrow="Journey history"
        title="Every completed trip, clearly explained."
        description="Review scores, XP, route quality and safety events instead of receiving a mysterious black-box rating."
        action={<Link href="/app/trip" className="mvp-button primary"><Gauge size={18} /> New trip</Link>}
      />

      {snapshot.trips.length === 0 ? (
        <EmptyState icon={<Route size={28} />} title="No completed trips yet" description="Run the safe-city simulation or record a live GPS journey to create your first result." action={<Link href="/app/trip" className="mvp-button primary">Start first trip</Link>} />
      ) : (
        <div className="mvp-trip-list">
          {snapshot.trips.map((trip) => {
            const analysis = snapshot.videoAnalyses.find((item) => item.tripId === trip.id);
            return (
            <article className="mvp-trip-card" key={trip.id}>
              <ScoreRing score={trip.safetyScore} size={88} />
              <div className="mvp-trip-card-main">
                <div className="mvp-trip-card-head">
                  <div><span className={`mvp-mode-badge ${trip.mode}`}>{trip.mode === "gps" ? "Live GPS" : "Simulation"}</span><h3>{trip.distanceKm.toFixed(1)} km safe journey</h3><p>{formatDate(trip.endedAt)}</p></div>
                  <strong className="mvp-xp-badge">+{trip.xpEarned} XP</strong>
                </div>
                <div className="mvp-trip-stats">
                  <span><Route size={16} /> {trip.distanceKm.toFixed(2)} km</span>
                  <span><Gauge size={16} /> {trip.averageSpeedKmh.toFixed(1)} km/h avg</span>
                  <span><MapPin size={16} /> GPS {Math.round(trip.gpsQuality * 100)}%</span>
                  <span><ShieldCheck size={16} /> {trip.overspeedEvents + trip.majorOverspeedEvents} safety events</span>
                  <span>{formatDuration(trip.durationSeconds)}</span>
                </div>
                {trip.events.length > 0 && (
                  <div className="mvp-event-list">
                    {trip.events.map((event, index) => <span key={`${event.type}-${index}`}>{event.detail} · −{event.penalty} score</span>)}
                  </div>
                )}
                <details className="mvp-xp-details">
                  <summary>See exactly how +{trip.xpEarned} XP was calculated</summary>
                  <XpBreakdownCard trip={trip} compact />
                </details>
                <div className="mvp-trip-evidence-row">
                  {analysis ? (
                    <span className={analysis.matchedRegisteredPlate ? "matched" : "review"}>
                      {analysis.matchedRegisteredPlate ? <CheckCircle2 size={14} /> : <Camera size={14} />}
                      {analysis.matchedRegisteredPlate ? `Video matched ${analysis.matchedPlate}` : "Video analysed · review evidence"}
                    </span>
                  ) : (
                    <Link href="/app/vision"><Camera size={14} /> Add video verification</Link>
                  )}
                </div>
              </div>
            </article>
          );})}
        </div>
      )}
    </>
  );
}
