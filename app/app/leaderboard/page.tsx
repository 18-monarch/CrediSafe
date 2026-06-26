"use client";

import { Crown, Medal, Trophy } from "lucide-react";
import { useMvp } from "@/components/mvp/MvpProvider";
import { LoadingState, PageHeader } from "@/components/mvp/UI";

export default function LeaderboardPage() {
  const { snapshot, ready } = useMvp();
  if (!ready) return <LoadingState />;
  const current = snapshot.leaderboard.find((entry) => entry.isCurrentUser);

  return (
    <>
      <PageHeader eyebrow="Friendly recognition" title="A leaderboard built around consistency." description="CrediSafe celebrates safer habits and steady improvement—not aggressive driving or speed." />

      <div className="mvp-rank-summary">
        <div><span>Your current rank</span><strong>#{current?.rank ?? "—"}</strong><small>{snapshot.profile.city} driver community</small></div>
        <Trophy size={48} />
      </div>

      <section className="mvp-panel mvp-leaderboard-panel">
        <div className="mvp-leaderboard-head"><span>Rank</span><span>Driver</span><span>Level</span><span>Lifetime XP</span></div>
        <div className="mvp-leaderboard-list">
          {snapshot.leaderboard.map((entry) => (
            <div className={entry.isCurrentUser ? "current" : ""} key={entry.id}>
              <span className="mvp-rank-number">{entry.rank <= 3 ? entry.rank === 1 ? <Crown size={20} /> : <Medal size={20} /> : `#${entry.rank}`}</span>
              <span className="mvp-driver-cell"><i>{entry.name.slice(0, 1)}</i><b>{entry.isCurrentUser ? "You" : entry.name}</b><small>{entry.city}</small></span>
              <span className="mvp-level-badge">{entry.level}</span>
              <strong>{entry.totalXp.toLocaleString("en-IN")} XP</strong>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
