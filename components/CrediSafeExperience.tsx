"use client";

import { motion } from "framer-motion";
import { SmoothScrollProvider } from "./SmoothScrollProvider";
import { DemoProvider, useDemo } from "./DemoContext";
import { Header, Brand } from "./Header";
import { Reveal } from "./Reveal";
import {
  ArrowIcon,
  CameraIcon,
  FuelIcon,
  GaugeIcon,
  PinIcon,
  RouteIcon,
  ShieldIcon,
  SparkIcon,
  TrophyIcon,
} from "./Icons";
import { DemoRunner } from "./DemoRunner";
import { VideoExperience } from "./VideoExperience";
import { MobileExperience } from "./MobileExperience";

function Content() {
  const demo = useDemo();

  return (
    <>
      <Header />
      <VideoExperience />
      <div className="noise" />
      <MobileExperience />

      <main className="story-main desktop-story">
        <section id="hero" className="story-section hero-section">
          <div className="section-shell story-grid">
            <div className="story-copy hero-copy">
              <Reveal><div className="eyebrow"><i /> Safe mobility intelligence</div></Reveal>
              <Reveal delay={0.05}><h1>Drive safe.<br /><span>Earn more.</span></h1></Reveal>
              <Reveal delay={0.1}>
                <p>CrediSafe turns responsible journeys into safety scores, XP, recognition and real-world rewards.</p>
              </Reveal>
              <Reveal delay={0.14} className="hero-actions">
                <a href="#demo" className="primary-button">Experience the product <ArrowIcon /></a>
                <a href="#journey" className="secondary-button">Explore the journey</a>
              </Reveal>
              <Reveal delay={0.18} className="hero-stats">
                <div><strong>{demo.score}/100</strong><span>Safety score</span></div>
                <div><strong>{demo.streak} days</strong><span>Safe streak</span></div>
                <div><strong>{demo.rewardProgress}%</strong><span>Reward unlocked</span></div>
              </Reveal>
            </div>
          </div>
          <a className="scroll-cue" href="#journey"><span>Scroll to drive</span><i /></a>
        </section>

        <section id="journey" className="story-section">
          <div className="section-shell story-grid">
            <div className="story-copy">
              <Reveal><div className="section-kicker"><RouteIcon /> Journey intelligence</div></Reveal>
              <Reveal delay={0.05}><h2>Every trip becomes useful signal.</h2></Reveal>
              <Reveal delay={0.1}><p>Distance, duration and speed are transformed into a clear safety result—without turning the experience into surveillance.</p></Reveal>
              <Reveal delay={0.14} className="feature-lines">
                <span><i /> Real browser GPS trip mode</span>
                <span><i /> Guided simulation mode</span>
                <span><i /> Location used only during active trips</span>
              </Reveal>
            </div>
          </div>
        </section>

        <section id="progression" className="story-section">
          <div className="section-shell story-grid">
            <div className="story-copy">
              <Reveal><div className="section-kicker"><SparkIcon /> Positive progression</div></Reveal>
              <Reveal delay={0.05}><h2>Safe driving should feel valuable.</h2></Reveal>
              <Reveal delay={0.1}><p>A journey becomes a score. The score becomes XP. Consistency becomes a level drivers can see and feel proud of.</p></Reveal>
              <Reveal delay={0.14} className="compact-cards">
                <article><strong>+186 XP</strong><span>Transparent trip total</span></article>
                <article><strong>97</strong><span>Safety score</span></article>
                <article><strong>Gold</strong><span>Current level</span></article>
              </Reveal>
              <Reveal delay={0.18} className="level-line">
                <div><span>Gold Driver</span><b>{demo.totalXp.toLocaleString("en-IN")} / 2,000 XP</b></div>
                <div className="progress-track"><motion.div className="progress-fill" animate={{ width: `${Math.min(100, Math.round((demo.totalXp / 2000) * 100))}%` }} /></div>
              </Reveal>
            </div>
          </div>
        </section>

        <section id="rewards" className="story-section">
          <div className="section-shell story-grid">
            <div className="story-copy">
              <Reveal><div className="section-kicker gold"><FuelIcon /> Real-world value</div></Reveal>
              <Reveal delay={0.05}><h2>Progress turns into something useful.</h2></Reveal>
              <Reveal delay={0.1}><p>Reward progress can lead toward fuel vouchers, FASTag cashback, insurance benefits and EV charging partnerships.</p></Reveal>
              <Reveal delay={0.14} className="reward-card-main">
                <div><small>Next reward</small><strong>₹200 Fuel Voucher</strong><span>{Math.max(0, 2000 - demo.rewardPoints).toLocaleString("en-IN")} points remaining</span></div>
                <b>{demo.rewardProgress}%</b>
              </Reveal>
              <Reveal delay={0.18} className="reward-pills"><span>FASTag cashback</span><span>Insurance benefit</span><span>EV charging</span></Reveal>
            </div>
          </div>
        </section>

        <section id="leaderboard" className="story-section">
          <div className="section-shell story-grid">
            <div className="story-copy">
              <Reveal><div className="section-kicker"><TrophyIcon /> Friendly recognition</div></Reveal>
              <Reveal delay={0.05}><h2>Improvement deserves recognition.</h2></Reveal>
              <Reveal delay={0.1}><p>The leaderboard celebrates consistency and safer habits without turning responsible driving into aggressive competition.</p></Reveal>
              <Reveal delay={0.14} className="leader-list">
                <div><span>{Math.max(1, demo.rank - 2)}</span><b>Neha Shah</b><small>{(demo.totalXp + 100).toLocaleString("en-IN")} XP</small></div>
                <div><span>{Math.max(1, demo.rank - 1)}</span><b>Arjun Verma</b><small>{(demo.totalXp + 30).toLocaleString("en-IN")} XP</small></div>
                <div className="you"><span>{demo.rank}</span><b>You</b><small>{demo.totalXp.toLocaleString("en-IN")} XP</small></div>
              </Reveal>
            </div>
          </div>
        </section>

        <section id="integrations" className="story-section">
          <div className="section-shell story-grid">
            <div className="story-copy wide-copy">
              <Reveal><div className="section-kicker"><ShieldIcon /> Real-world layer</div></Reveal>
              <Reveal delay={0.05}><h2>Connected intelligence for every journey.</h2></Reveal>
              <Reveal delay={0.1}><p>GPS, video intelligence and transparent scoring work together while specialised integrations remain clearly separated.</p></Reveal>
              <div className="integration-cards">
                <Reveal delay={0.12}><article><PinIcon /><span className="status real">Available</span><h3>Browser GPS trips</h3><p>Distance, duration, speed and safety scoring.</p></article></Reveal>
                <Reveal delay={0.16}><article><GaugeIcon /><span className="status simulated">Simulated</span><h3>Vehicle & FASTag</h3><p>Prepared for future official APIs and partner access.</p></article></Reveal>
                <Reveal delay={0.2}><article><CameraIcon /><span className="status simulated">Simulated</span><h3>Video intelligence</h3><p>Plate verification, visible road objects and reviewable evidence.</p></article></Reveal>
              </div>
            </div>
          </div>
        </section>

        <section id="pilot" className="story-section pilot-section">
          <div className="section-shell story-grid">
            <div className="story-copy wide-copy">
              <Reveal><div className="section-kicker"><ShieldIcon /> Pilot-ready product loop</div></Reveal>
              <Reveal delay={0.05}><h2>Built to test behaviour—not just present an idea.</h2></Reveal>
              <Reveal delay={0.1}><p>CrediSafe already connects identity, GPS journeys, transparent XP, reward progress and reviewable video evidence inside one measurable experience.</p></Reveal>
              <div className="pilot-proof-grid">
                <Reveal delay={0.12}><article><span>01</span><h3>Working journey data</h3><p>Live browser GPS, quality filtering and explainable safety results.</p></article></Reveal>
                <Reveal delay={0.16}><article><span>02</span><h3>Transparent progression</h3><p>XP Engine 2.0 separates lifetime recognition from spendable reward points.</p></article></Reveal>
                <Reveal delay={0.2}><article><span>03</span><h3>Evidence with boundaries</h3><p>Plate matching and visible observations stay confidence-led and reviewable.</p></article></Reveal>
                <Reveal delay={0.24}><article><span>04</span><h3>Secure user ownership</h3><p>Supabase authentication and row-level policies separate profiles, trips and vehicles.</p></article></Reveal>
              </div>
              <Reveal delay={0.28} className="pilot-trust-line"><i /> Video evidence never silently changes a driver score or reward.</Reveal>
            </div>
          </div>
        </section>

        <section id="demo" className="story-section demo-section">
          <div className="section-shell demo-layout">
            <div className="story-copy">
              <Reveal><div className="section-kicker"><SparkIcon /> Interactive journey</div></Reveal>
              <Reveal delay={0.05}><h2>See one safe trip change everything.</h2></Reveal>
              <Reveal delay={0.1}><p>Run the complete product loop. The cinematic journey and interface respond together—score, XP, reward and rank.</p></Reveal>
            </div>
            <Reveal delay={0.12}><DemoRunner /></Reveal>
          </div>
        </section>

        <section id="final" className="story-section final-section">
          <div className="section-shell final-copy">
            <Reveal><div className="section-kicker">CrediSafe</div></Reveal>
            <Reveal delay={0.05}><h2>Turn every safe journey into progress.</h2></Reveal>
            <Reveal delay={0.1}><p>The cinematic experience connects directly to GPS trips, video intelligence, scoring, XP, rewards and leaderboard progress.</p></Reveal>
            <Reveal delay={0.14} className="hero-actions centered">
              <a href="/app/dashboard" className="primary-button">Open CrediSafe</a>
              <a href="#hero" className="secondary-button">Back to top</a>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="site-footer desktop-footer">
        <Brand />
        <p>Official integrations require permissions and verified partnerships.</p>
        <span>Drive safe. Earn more.</span>
      </footer>
    </>
  );
}

export function CrediSafeExperience() {
  return (
    <SmoothScrollProvider>
      <DemoProvider><Content /></DemoProvider>
    </SmoothScrollProvider>
  );
}
