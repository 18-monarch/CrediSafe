"use client";

import type { ReactNode } from "react";
import { Award, CheckCircle2, Route, Satellite, ShieldCheck, Sparkles, Trophy, Zap } from "lucide-react";
import type { Trip, XpBreakdownCode } from "@/lib/mvp/types";

const iconMap: Record<XpBreakdownCode, ReactNode> = {
  completion: <CheckCircle2 size={16} />,
  safety: <ShieldCheck size={16} />,
  distance: <Route size={16} />,
  clean_trip: <Sparkles size={16} />,
  gps_quality: <Satellite size={16} />,
  streak: <Trophy size={16} />,
  cap: <Zap size={16} />,
  eligibility: <ShieldCheck size={16} />,
};

export function XpBreakdownCard({ trip, compact = false }: { trip: Trip; compact?: boolean }) {
  const breakdown = trip.xpBreakdown;
  return (
    <section className={`mvp-xp-breakdown ${compact ? "compact" : ""} ${breakdown.eligible ? "eligible" : "ineligible"}`}>
      <div className="mvp-xp-breakdown-head">
        <div>
          <span>XP Engine {breakdown.version}</span>
          <h3>{breakdown.eligible ? "How your XP was calculated" : "Why no XP was awarded"}</h3>
        </div>
        <div className="mvp-xp-total">
          <strong>{trip.xpEarned > 0 ? `+${trip.xpEarned}` : "0"}</strong>
          <span>XP</span>
        </div>
      </div>

      <div className="mvp-xp-lines">
        {breakdown.items.map((item, index) => (
          <div className={item.points < 0 ? "negative" : ""} key={`${item.code}-${index}`}>
            <i>{iconMap[item.code]}</i>
            <span><strong>{item.label}</strong><small>{item.detail}</small></span>
            <b>{item.points > 0 ? `+${item.points}` : item.points}</b>
          </div>
        ))}
      </div>

      <div className="mvp-xp-summary">
        <div><Zap size={16} /><span><small>Lifetime progress</small><strong>+{trip.xpEarned} XP</strong></span></div>
        <div><Award size={16} /><span><small>Spendable value</small><strong>+{trip.rewardPointsEarned} points</strong></span></div>
      </div>
      <p className="mvp-xp-note">{breakdown.note}</p>
    </section>
  );
}
