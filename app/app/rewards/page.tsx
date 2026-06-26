"use client";

import { Award, CheckCircle2, Fuel, LockKeyhole, TicketCheck, Zap } from "lucide-react";
import { formatDate } from "@/components/mvp/Formatters";
import { useMvp } from "@/components/mvp/MvpProvider";
import { LoadingState, PageHeader } from "@/components/mvp/UI";

export default function RewardsPage() {
  const { snapshot, ready, busy, claimReward } = useMvp();
  if (!ready) return <LoadingState />;

  return (
    <>
      <PageHeader eyebrow="Rewards" title="Safe driving becomes useful value." description="XP tracks lifetime progress. Real GPS trips separately convert 50% of awarded XP into spendable reward points." />

      <section className="mvp-reward-balance">
        <div><span>Available reward points</span><strong>{snapshot.profile.rewardPoints.toLocaleString("en-IN")}</strong><small>Earned from eligible real GPS trips—not simulations</small></div>
        <Award size={46} />
      </section>

      <section className="mvp-reward-grid">
        {snapshot.rewards.map((reward) => {
          const available = snapshot.profile.rewardPoints >= reward.pointsCost;
          const progress = Math.min(100, Math.round((snapshot.profile.rewardPoints / reward.pointsCost) * 100));
          return (
            <article className="mvp-reward-card" key={reward.id}>
              <div className="mvp-reward-icon">{reward.rewardType === "fuel" ? <Fuel /> : reward.rewardType === "fastag" ? <TicketCheck /> : <Zap />}</div>
              <span className="mvp-simulated-label">Simulated reward</span>
              <h3>{reward.title}</h3>
              <p>{reward.description}</p>
              <div className="mvp-reward-cost"><strong>{reward.pointsCost.toLocaleString("en-IN")}</strong><span>points</span></div>
              <div className="mvp-progress"><i style={{ width: `${progress}%` }} /></div>
              <small>{available ? "Ready to claim" : `${(reward.pointsCost - snapshot.profile.rewardPoints).toLocaleString("en-IN")} more points required`}</small>
              <button className={`mvp-button ${available ? "primary" : "secondary"}`} disabled={!available || busy} onClick={() => claimReward(reward.id).catch(() => undefined)}>
                {available ? <><CheckCircle2 size={17} /> Claim simulated reward</> : <><LockKeyhole size={17} /> Locked</>}
              </button>
            </article>
          );
        })}
      </section>

      <section className="mvp-panel mvp-claims-panel">
        <div className="mvp-section-heading"><div><span>Claim history</span><h2>Reward vouchers</h2></div></div>
        {snapshot.claims.length === 0 ? <p className="mvp-muted">No rewards claimed yet.</p> : (
          <div className="mvp-claim-list">
            {snapshot.claims.map((claim) => (
              <div key={claim.id}><CheckCircle2 size={19} /><div><strong>{claim.rewardTitle}</strong><span>{formatDate(claim.createdAt)} · {claim.pointsSpent.toLocaleString("en-IN")} points</span></div><code>{claim.voucherCode}</code></div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
