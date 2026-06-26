"use client";

import {
  ArrowRight,
  Camera,
  Check,
  Database,
  Fuel,
  Gauge,
  LockKeyhole,
  MapPin,
  Route,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import { motion } from "framer-motion";
import { useDemo } from "./DemoContext";
import { Reveal } from "./Reveal";

const xpRows = [
  ["Valid trip completion", "+25"],
  ["Safety score 97/100", "+110"],
  ["Validated distance", "+16"],
  ["Clean-trip bonus", "+25"],
  ["Trusted GPS data", "+15"],
] as const;

const workingNow = [
  {
    icon: <Route size={20} />,
    title: "Live journey capture",
    body: "Distance, duration, speed and GPS quality are recorded only while a trip is active.",
  },
  {
    icon: <Sparkles size={20} />,
    title: "Explainable XP",
    body: "Every point is broken down clearly, with eligibility and anti-gaming limits built in.",
  },
  {
    icon: <Camera size={20} />,
    title: "Reviewable evidence",
    body: "Plate matching and visible road observations stay confidence-led and human-reviewable.",
  },
  {
    icon: <LockKeyhole size={20} />,
    title: "User-owned data",
    body: "Supabase authentication and row-level policies keep profiles, trips and vehicles separated.",
  },
] as const;

export function MobileExperience() {
  const demo = useDemo();

  return (
    <main className="mobile-experience">
      <section className="mobile-hero" aria-labelledby="mobile-hero-title">
        <div className="mobile-hero-media" aria-hidden="true">
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/video/credisafe-poster-mobile.webp"
          >
            <source src="/video/credisafe-drive-portrait.mp4" type="video/mp4" />
            <source src="/video/credisafe-drive-mobile.mp4" type="video/mp4" />
          </video>
          <div className="mobile-hero-grade" />
          <div className="mobile-hero-glow" />
        </div>

        <div className="mobile-hero-content">
          <Reveal>
            <div className="mobile-kicker"><i /> Safe mobility intelligence</div>
          </Reveal>
          <Reveal delay={0.04}>
            <h1 id="mobile-hero-title">Drive safe.<br /><span>Earn more.</span></h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p>CrediSafe turns responsible journeys into transparent scores, XP and useful reward progress.</p>
          </Reveal>
          <Reveal delay={0.12} className="mobile-hero-actions">
            <a href="/app/trip" className="mobile-primary-action">Start your journey <ArrowRight size={17} /></a>
            <a href="#mobile-proof" className="mobile-text-link">See how it works <ArrowRight size={15} /></a>
          </Reveal>

          <Reveal delay={0.16} className="mobile-proof-strip">
            <div><strong>{demo.score}</strong><span>Safety score</span></div>
            <div><strong>+186</strong><span>Explainable XP</span></div>
            <div><strong>+93</strong><span>Reward points</span></div>
          </Reveal>
        </div>
      </section>

      <section id="mobile-proof" className="mobile-section mobile-result-section">
        <Reveal>
          <div className="mobile-section-kicker"><Gauge size={16} /> One transparent result</div>
          <h2>Drivers should always know why they earned it.</h2>
          <p>CrediSafe converts one eligible journey into a safety result with no hidden scoring.</p>
        </Reveal>

        <Reveal delay={0.08} className="mobile-result-card">
          <div className="mobile-result-top">
            <div className="mobile-score-ring"><span><strong>97</strong><small>Safety</small></span></div>
            <div>
              <span className="mobile-live-label"><i /> Eligible GPS trip</span>
              <h3>+191 XP</h3>
              <p>Clear, capped and reviewable.</p>
            </div>
          </div>
          <div className="mobile-xp-lines">
            {xpRows.map(([label, value]) => (
              <div key={label}><span>{label}</span><strong>{value}</strong></div>
            ))}
          </div>
          <div className="mobile-result-summary">
            <span>Lifetime progress <b>+191 XP</b></span>
            <span>Spendable value <b>+95 points</b></span>
          </div>
        </Reveal>

        <Reveal delay={0.14} className="mobile-loop-card">
          <span>Complete product loop</span>
          <div className="mobile-loop-flow">
            {[
              ["01", "Trip"],
              ["02", "Score"],
              ["03", "XP"],
              ["04", "Reward"],
              ["05", "Rank"],
            ].map(([number, label], index) => (
              <div key={label}>
                <i>{number}</i><strong>{label}</strong>{index < 4 && <em>→</em>}
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="mobile-section mobile-journey-section">
        <Reveal>
          <div className="mobile-section-kicker"><Route size={16} /> Journey intelligence</div>
          <h2>Every trip becomes useful signal.</h2>
          <p>CrediSafe collects only the data needed to understand an active journey and explain its outcome.</p>
        </Reveal>

        <div className="mobile-feature-stack">
          <Reveal delay={0.04}>
            <article><span><MapPin size={19} /></span><div><h3>Trip-aware location</h3><p>Location is used only while the driver actively records a journey.</p></div><Check size={17} /></article>
          </Reveal>
          <Reveal delay={0.08}>
            <article><span><Gauge size={19} /></span><div><h3>Quality-controlled GPS</h3><p>Inaccurate points and impossible movement are removed before scoring.</p></div><Check size={17} /></article>
          </Reveal>
          <Reveal delay={0.12}>
            <article><span><ShieldCheck size={19} /></span><div><h3>Visible reasoning</h3><p>Safety events, confidence and XP effects stay understandable.</p></div><Check size={17} /></article>
          </Reveal>
        </div>
      </section>

      <section className="mobile-section mobile-reward-section">
        <Reveal>
          <div className="mobile-section-kicker gold"><Fuel size={16} /> Useful value</div>
          <h2>Progress should lead somewhere meaningful.</h2>
          <p>Lifetime XP builds recognition. Eligible GPS trips separately create reward points for future partner benefits.</p>
        </Reveal>

        <Reveal delay={0.08} className="mobile-reward-card">
          <div className="mobile-reward-head">
            <span><Fuel size={20} /></span>
            <div><small>Next reward</small><strong>₹200 Fuel Voucher</strong></div>
            <b>{demo.rewardProgress}%</b>
          </div>
          <div className="mobile-reward-track"><motion.span initial={{ width: 0 }} whileInView={{ width: `${demo.rewardProgress}%` }} viewport={{ once: true }} transition={{ duration: 1.1 }} /></div>
          <div className="mobile-reward-meta"><span>{demo.rewardPoints.toLocaleString("en-IN")} points earned</span><strong>{Math.max(0, 2000 - demo.rewardPoints).toLocaleString("en-IN")} remaining</strong></div>
        </Reveal>

        <Reveal delay={0.12} className="mobile-reward-types">
          <span>FASTag cashback</span><span>Insurance benefits</span><span>EV charging</span>
        </Reveal>
      </section>

      <section className="mobile-section mobile-pilot-section">
        <Reveal>
          <div className="mobile-section-kicker"><Database size={16} /> Built for a measurable pilot</div>
          <h2>A real product loop—not just a concept screen.</h2>
          <p>The current architecture is designed to test whether drivers understand, trust and return to a safety-reward experience.</p>
        </Reveal>

        <div className="mobile-working-grid">
          {workingNow.map((item, index) => (
            <Reveal delay={0.04 + index * 0.04} key={item.title}>
              <article><span>{item.icon}</span><h3>{item.title}</h3><p>{item.body}</p></article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2} className="mobile-trust-note">
          <ShieldCheck size={20} />
          <div><strong>Credibility before automation</strong><p>Video observations never silently change scores or rewards. Low-confidence evidence stays reviewable.</p></div>
        </Reveal>
      </section>

      <section className="mobile-section mobile-rank-section">
        <Reveal>
          <div className="mobile-section-kicker"><Trophy size={16} /> Positive recognition</div>
          <h2>Make safer habits visible.</h2>
          <p>Levels, streaks and rankings recognise consistency without encouraging aggressive competition.</p>
        </Reveal>
        <Reveal delay={0.08} className="mobile-rank-card">
          <div><span>{Math.max(1, demo.rank - 1)}</span><b>Arjun Verma</b><small>{(demo.totalXp + 30).toLocaleString("en-IN")} XP</small></div>
          <div className="you"><span>{demo.rank}</span><b>You</b><small>{demo.totalXp.toLocaleString("en-IN")} XP</small></div>
          <div><span>{demo.rank + 1}</span><b>Rohan Mehta</b><small>{Math.max(0, demo.totalXp - 40).toLocaleString("en-IN")} XP</small></div>
        </Reveal>
      </section>

      <section className="mobile-section mobile-final-section">
        <Reveal>
          <span className="mobile-final-mark"><ShieldCheck size={26} /></span>
          <h2>Turn every safe journey into progress.</h2>
          <p>Record a trip, understand the result and watch responsible behaviour become visible value.</p>
          <a href="/app/dashboard" className="mobile-primary-action">Open CrediSafe <ArrowRight size={17} /></a>
        </Reveal>
      </section>

      <footer className="mobile-footer">
        <strong>CrediSafe</strong>
        <span>Drive safe. Earn more.</span>
      </footer>
    </main>
  );
}
