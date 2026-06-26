"use client";

import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useDemo } from "./DemoContext";

const chapters = [
  { id: "hero", label: "Vision" },
  { id: "journey", label: "Journey" },
  { id: "progression", label: "Progress" },
  { id: "rewards", label: "Rewards" },
  { id: "leaderboard", label: "Rank" },
  { id: "integrations", label: "Real-world" },
  { id: "pilot", label: "Pilot" },
  { id: "demo", label: "Demo" },
  { id: "final", label: "Impact" },
] as const;

const demoLabels = [
  "Vehicle verified",
  "Trip started",
  "Journey recorded",
  "Safety analysed",
  "+186 XP explained",
  "+93 reward points",
  "City rank improved",
  "Safe trip complete",
];

const demoProgressPoints = [0.08, 0.18, 0.31, 0.44, 0.58, 0.7, 0.83, 0.94] as const;

function timeAtProgress(duration: number, progress: number) {
  return Math.max(0.03, Math.min(duration - 0.03, duration * progress));
}

export function VideoExperience() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const durationRef = useRef(10);
  const scrollTargetRef = useRef(0.04);
  const demoTargetRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const releaseTimerRef = useRef<number | null>(null);
  const activeChapterRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [activeChapter, setActiveChapter] = useState(0);
  const [chapterProgress, setChapterProgress] = useState(0);
  const [demoStep, setDemoStep] = useState(-1);
  const demo = useDemo();

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const video = videoRef.current;
    if (!video) return;

    const desktopLayout = window.matchMedia("(min-width: 901px)").matches;
    if (!desktopLayout) {
      setReady(true);
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let chapterProgressFrame = 0;

    const setInitialFrame = () => {
      durationRef.current = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 10;
      video.currentTime = reducedMotion
        ? timeAtProgress(durationRef.current, 0.46)
        : timeAtProgress(durationRef.current, 0.01);
      setReady(true);
      setVideoFailed(false);
      requestAnimationFrame(() => ScrollTrigger.refresh());
    };

    if (video.readyState >= 1) setInitialFrame();
    else video.addEventListener("loadedmetadata", setInitialFrame, { once: true });

    const activateChapter = (index: number) => {
      activeChapterRef.current = index;
      setActiveChapter(index);
      setChapterProgress(0);
    };

    const triggers = chapters.map((chapter, index) =>
      ScrollTrigger.create({
        trigger: `#${chapter.id}`,
        start: "top 62%",
        end: "bottom 38%",
        onEnter: () => activateChapter(index),
        onEnterBack: () => activateChapter(index),
        onUpdate: (self) => {
          if (index !== activeChapterRef.current) return;
          window.cancelAnimationFrame(chapterProgressFrame);
          chapterProgressFrame = window.requestAnimationFrame(() => setChapterProgress(self.progress));
        },
      }),
    );

    const scrubTrigger = ScrollTrigger.create({
      trigger: document.documentElement,
      start: "top top",
      end: "max",
      onUpdate: (self) => {
        const safeDuration = Math.max(0.2, durationRef.current - 0.06);
        scrollTargetRef.current = 0.04 + self.progress * (safeDuration - 0.04);
        if (progressRef.current) {
          progressRef.current.style.transform = `scaleX(${self.progress})`;
        }
      },
    });

    let lastSeek = 0;
    const tick = (now: number) => {
      const target = demoTargetRef.current ?? scrollTargetRef.current;
      const current = video.currentTime;
      const difference = target - current;
      const smoothing = Math.abs(difference) > 0.9 ? 0.28 : 0.16;
      const next = current + difference * smoothing;

      if (
        !reducedMotion &&
        video.readyState >= 2 &&
        !video.seeking &&
        Math.abs(next - current) > 0.01 &&
        now - lastSeek > 24
      ) {
        video.currentTime = Math.max(0.01, Math.min(durationRef.current - 0.03, next));
        lastSeek = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    const handleDemoStart = () => {
      if (releaseTimerRef.current) window.clearTimeout(releaseTimerRef.current);
      demoTargetRef.current = timeAtProgress(durationRef.current, demoProgressPoints[0]);
      setDemoStep(0);
    };

    const handleDemoStep = (event: Event) => {
      const index = (event as CustomEvent<{ index: number }>).detail.index;
      setDemoStep(index);
      const progressPoint = demoProgressPoints[Math.min(index, demoProgressPoints.length - 1)];
      demoTargetRef.current = timeAtProgress(durationRef.current, progressPoint);
    };

    const handleDemoComplete = () => {
      setDemoStep(7);
      demoTargetRef.current = timeAtProgress(durationRef.current, 0.975);
      releaseTimerRef.current = window.setTimeout(() => {
        demoTargetRef.current = null;
      }, 1500);
    };

    const handleDemoReset = () => {
      setDemoStep(-1);
      demoTargetRef.current = null;
    };

    window.addEventListener("credisafe:demo-start", handleDemoStart);
    window.addEventListener("credisafe:demo-step", handleDemoStep);
    window.addEventListener("credisafe:demo-complete", handleDemoComplete);
    window.addEventListener("credisafe:demo-reset", handleDemoReset);

    return () => {
      video.removeEventListener("loadedmetadata", setInitialFrame);
      triggers.forEach((trigger) => trigger.kill());
      scrubTrigger.kill();
      window.cancelAnimationFrame(chapterProgressFrame);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (releaseTimerRef.current) window.clearTimeout(releaseTimerRef.current);
      window.removeEventListener("credisafe:demo-start", handleDemoStart);
      window.removeEventListener("credisafe:demo-step", handleDemoStep);
      window.removeEventListener("credisafe:demo-complete", handleDemoComplete);
      window.removeEventListener("credisafe:demo-reset", handleDemoReset);
    };
  }, []);

  return (
    <div className={`cinematic-stage desktop-cinematic chapter-${activeChapter}`} aria-hidden="true">
      <video
        ref={videoRef}
        className="cinematic-video"
        muted
        playsInline
        preload="auto"
        poster="/video/credisafe-poster.webp"
        disablePictureInPicture
        tabIndex={-1}
        onLoadedData={() => setReady(true)}
        onError={() => {
          setReady(true);
          setVideoFailed(true);
        }}
      >
        <source media="(max-width: 760px)" src="/video/credisafe-drive-mobile.mp4" type="video/mp4" />
        <source src="/video/credisafe-drive.mp4" type="video/mp4" />
        <source src="/video/credisafe-drive.webm" type="video/webm" />
      </video>

      <div className="video-grade" />
      <div className="video-accent" />
      <div className="video-vignette" />
      <div className="cinematic-bars top" />
      <div className="cinematic-bars bottom" />
      <div className="cinematic-progress"><span ref={progressRef} /></div>

      <AnimatePresence>
        {!ready && (
          <motion.div className="video-loader" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <span />
            <small>Loading cinematic journey</small>
          </motion.div>
        )}
        {videoFailed && (
          <motion.div className="video-loader video-fallback" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <small>Cinematic video unavailable — product experience remains active</small>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="chapter-rail">
        {chapters.map((chapter, index) => (
          <a
            href={`#${chapter.id}`}
            key={chapter.id}
            className={index === activeChapter ? "active" : ""}
            aria-label={`Go to ${chapter.label}`}
          >
            <i />
            <span>{String(index + 1).padStart(2, "0")}</span>
          </a>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${activeChapter}-${demoStep}`}
          className={`product-overlay overlay-${activeChapter}`}
          initial={{ opacity: 0, y: 18, scale: 0.98, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -12, scale: 0.985, filter: "blur(8px)" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <OverlayContent
            chapter={activeChapter}
            chapterProgress={chapterProgress}
            demoStep={demoStep}
            demo={demo}
          />
        </motion.div>
      </AnimatePresence>

      <div className="chapter-status">
        <span>{String(activeChapter + 1).padStart(2, "0")}</span>
        <strong>{chapters[activeChapter].label}</strong>
      </div>
    </div>
  );
}

function OverlayContent({
  chapter,
  chapterProgress,
  demoStep,
  demo,
}: {
  chapter: number;
  chapterProgress: number;
  demoStep: number;
  demo: ReturnType<typeof useDemo>;
}) {
  if (chapter === 0) return <HeroOverlay />;
  if (chapter === 1) return <JourneyOverlay progress={chapterProgress} />;
  if (chapter === 2) return <ProgressOverlay levelProgress={Math.min(100, Math.round((demo.totalXp / 2000) * 100))} />;
  if (chapter === 3) return <RewardOverlay progress={demo.rewardProgress} />;
  if (chapter === 4) return <LeaderboardOverlay rank={demo.rank} totalXp={demo.totalXp} />;
  if (chapter === 5) return <IntegrationOverlay />;
  if (chapter === 6) return <PilotOverlay />;
  if (chapter === 7) return <DemoOverlay demoStep={demoStep} />;
  return <FinalOverlay />;
}

function HeroOverlay() {
  return (
    <div className="hero-system-pill">
      <span className="system-pulse"><i /></span>
      <div>
        <small>Journey intelligence</small>
        <strong>System online</strong>
      </div>
      <span className="system-state">Live</span>
    </div>
  );
}

function JourneyOverlay({ progress }: { progress: number }) {
  const distance = (2.1 + progress * 6.3).toFixed(1);
  const speed = Math.round(34 + progress * 18);
  const elapsed = Math.round(7 + progress * 11);

  return (
    <div className="hud-panel journey-hud">
      <div className="hud-panel-head">
        <span><i className="recording-dot" /> Trip recording active</span>
        <b>GPS</b>
      </div>
      <div className="journey-gauge">
        <div className="speed-number"><strong>{speed}</strong><small>km/h</small></div>
        <div className="speed-arc"><span style={{ "--arc": `${Math.min(100, speed + 22)}%` } as CSSProperties} /></div>
      </div>
      <div className="journey-metrics">
        <Metric value={distance} label="km travelled" />
        <Metric value={`${elapsed}:24`} label="elapsed" />
        <Metric value="±4 m" label="GPS accuracy" />
      </div>
      <div className="route-track"><span /><i /><i /><i /></div>
    </div>
  );
}

function ProgressOverlay({ levelProgress }: { levelProgress: number }) {
  const particles = useMemo(() => Array.from({ length: 9 }, (_, index) => index), []);

  return (
    <div className="hud-panel progress-hud">
      <div className="hud-panel-head">
        <span>Safe trip recorded</span>
        <b className="safe-badge">Excellent</b>
      </div>
      <div className="progress-core">
        <div className="score-orbit">
          <svg viewBox="0 0 100 100">
            <circle className="score-base" cx="50" cy="50" r="42" />
            <motion.circle
              className="score-value"
              cx="50"
              cy="50"
              r="42"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 0.97 }}
              transition={{ duration: 1.25, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
          <div><strong>97</strong><small>Safety score</small></div>
        </div>
        <div className="xp-stack">
          <motion.strong
            initial={{ opacity: 0, scale: 0.78, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 220, damping: 18 }}
          >
            +186 XP
          </motion.strong>
          <span>Safety + distance + clean-trip bonus</span>
          <div className="level-progress-row"><small>Gold</small><small>Platinum</small></div>
          <div className="level-progress"><motion.span initial={{ width: "48%" }} animate={{ width: `${levelProgress}%` }} transition={{ duration: 1.1, delay: 0.25 }} /></div>
          <div className="xp-particles">
            {particles.map((particle) => (
              <motion.i
                key={particle}
                initial={{ x: -18, y: 16 - particle * 3, opacity: 0, scale: 0.4 }}
                animate={{ x: 155, y: 2, opacity: [0, 1, 0], scale: [0.4, 1, 0.35] }}
                transition={{ duration: 1.25, delay: particle * 0.08, repeat: Infinity, repeatDelay: 1.4 }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RewardOverlay({ progress }: { progress: number }) {
  return (
    <div className="hud-panel reward-hud">
      <div className="reward-coin-wrap">
        <motion.div
          className="reward-coin"
          animate={{ rotateY: [0, 360], y: [0, -5, 0] }}
          transition={{ rotateY: { duration: 4.2, repeat: Infinity, ease: "linear" }, y: { duration: 2, repeat: Infinity } }}
        >₹</motion.div>
        <span className="reward-orbit" />
      </div>
      <div className="reward-copy">
        <span className="gold-label">Reward progress</span>
        <strong>Fuel reward +9%</strong>
        <p>Safe driving converted into useful value.</p>
        <div className="reward-level"><span>₹200 Fuel Voucher</span><b>{progress}%</b></div>
        <div className="gold-progress"><motion.span initial={{ width: `${Math.max(0, progress - 9)}%` }} animate={{ width: `${progress}%` }} transition={{ duration: 1.2 }} /></div>
      </div>
      <motion.div className="reward-shimmer" animate={{ x: ["-160%", "260%"] }} transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 1.2 }} />
    </div>
  );
}

function LeaderboardOverlay({ rank, totalXp }: { rank: number; totalXp: number }) {
  return (
    <div className="hud-panel leaderboard-hud">
      <div className="hud-panel-head"><span>City leaderboard</span><b>Weekly</b></div>
      <div className="rank-morph">
        <motion.span initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0.35, y: -5 }}>#{rank + 2}</motion.span>
        <motion.i animate={{ y: [5, -3, 5] }} transition={{ duration: 1.5, repeat: Infinity }}>↑</motion.i>
        <motion.strong initial={{ scale: 0.72, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 180 }}>#{rank}</motion.strong>
      </div>
      <div className="rank-list-mini">
        <div><span>{Math.max(1, rank - 1)}</span><b>Arjun Verma</b><small>{(totalXp + 30).toLocaleString("en-IN")} XP</small></div>
        <motion.div className="you" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}><span>{rank}</span><b>You</b><small>{totalXp.toLocaleString("en-IN")} XP</small></motion.div>
        <div><span>{rank + 1}</span><b>Rohan Mehta</b><small>{Math.max(0, totalXp - 40).toLocaleString("en-IN")} XP</small></div>
      </div>
      <div className="rank-note">Consistency moved you up two places.</div>
    </div>
  );
}

function IntegrationOverlay() {
  return (
    <div className="hud-panel integration-hud">
      <div className="integration-map">
        <svg viewBox="0 0 320 160" role="presentation">
          <path d="M38 116 C86 26 140 142 199 62 C236 12 271 53 292 26" />
          <circle cx="38" cy="116" r="6" />
          <circle cx="129" cy="92" r="6" />
          <circle cx="199" cy="62" r="6" />
          <circle cx="292" cy="26" r="6" />
        </svg>
        <motion.span className="scan-line" animate={{ x: [0, 280, 0] }} transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }} />
      </div>
      <div className="integration-statuses">
        <StatusRow label="GPS trip data" note="Working demo" kind="real" delay={0} />
        <StatusRow label="Vehicle / FASTag" note="Simulation" kind="sim" delay={0.12} />
        <StatusRow label="Traffic-camera events" note="Simulation" kind="sim" delay={0.24} />
      </div>
    </div>
  );
}

function PilotOverlay() {
  return (
    <div className="hud-panel pilot-hud">
      <div className="hud-panel-head"><span>Pilot readiness</span><b>Working now</b></div>
      <div className="pilot-hud-list">
        <div><i>✓</i><span><strong>Journey scoring</strong><small>GPS quality, speed and transparent events</small></span></div>
        <div><i>✓</i><span><strong>XP Engine 2.0</strong><small>Explainable progression and reward separation</small></span></div>
        <div><i>✓</i><span><strong>Video evidence</strong><small>Confidence-led and reviewable observations</small></span></div>
        <div><i>✓</i><span><strong>User-owned data</strong><small>Authenticated profiles, vehicles and trips</small></span></div>
      </div>
    </div>
  );
}

function DemoOverlay({ demoStep }: { demoStep: number }) {
  const active = demoStep >= 0 ? demoStep : 0;
  return (
    <div className="hud-panel demo-hud">
      <div className="demo-scan-ring"><span>{demoStep >= 0 ? active + 1 : "–"}</span><i /></div>
      <div className="demo-overlay-copy">
        <small>Interactive presentation mode</small>
        <strong>{demoStep >= 0 ? demoLabels[active] : "Ready to simulate a safe trip"}</strong>
        <div className="demo-progress-line">
          {demoLabels.map((_, index) => <i key={index} className={index <= demoStep ? "done" : index === demoStep + 1 ? "next" : ""} />)}
        </div>
        <span>{demoStep >= 0 ? `${Math.round(((active + 1) / demoLabels.length) * 100)}% complete` : "Run the demo below"}</span>
      </div>
    </div>
  );
}

function FinalOverlay() {
  return (
    <div className="hud-panel final-hud">
      <motion.div className="success-mark" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 180, damping: 14 }}>✓</motion.div>
      <div><small>Journey complete</small><strong>Safe driving became progress.</strong><span>Score analysed · XP awarded · Reward advanced</span></div>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div><strong>{value}</strong><small>{label}</small></div>;
}

function StatusRow({ label, note, kind, delay }: { label: string; note: string; kind: "real" | "sim"; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay }}>
      <i className={kind} />
      <span><strong>{label}</strong><small>{note}</small></span>
      <b>✓</b>
    </motion.div>
  );
}
