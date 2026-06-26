"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CheckIcon, PlayIcon, ResetIcon } from "./Icons";
import { useDemo } from "./DemoContext";

const steps = [
  ["Vehicle verified", "Demo vehicle profile loaded"],
  ["Trip started", "Simulation mode activated"],
  ["Journey recorded", "8.4 km route completed"],
  ["Safety analysed", "Speed and safety events scored"],
  ["XP awarded", "Safe-trip and streak bonuses"],
  ["Reward advanced", "Fuel voucher progress updated"],
  ["Rank improved", "City leaderboard recalculated"],
  ["Safe trip complete", "Progress saved locally"],
];

export function DemoRunner() {
  const demo = useDemo();
  const [active, setActive] = useState(-1);
  const [running, setRunning] = useState(false);
  const runToken = useRef(0);
  const mounted = useRef(true);

  useEffect(() => () => {
    mounted.current = false;
    runToken.current += 1;
  }, []);

  async function wait(ms: number, token: number) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, ms));
    return mounted.current && token === runToken.current;
  }

  async function run() {
    if (running) return;
    const token = ++runToken.current;
    setRunning(true);
    setActive(-1);
    window.dispatchEvent(new CustomEvent("credisafe:demo-start"));

    for (let index = 0; index < steps.length; index += 1) {
      if (!mounted.current || token !== runToken.current) return;
      setActive(index);
      window.dispatchEvent(new CustomEvent("credisafe:demo-step", { detail: { index } }));
      const shouldContinue = await wait(index === steps.length - 1 ? 740 : 620, token);
      if (!shouldContinue) return;
    }

    demo.runTrip();
    window.dispatchEvent(new CustomEvent("credisafe:demo-complete"));
    if (mounted.current && token === runToken.current) setRunning(false);
  }

  function reset() {
    runToken.current += 1;
    setRunning(false);
    setActive(-1);
    demo.reset();
    window.dispatchEvent(new CustomEvent("credisafe:demo-reset"));
  }

  const liveDistance = active >= 2 ? 8.4 : 0;
  const liveScore = active >= 3 ? 97 : demo.score;
  const liveXp = active >= 4 ? 175 : demo.lastTripXp;
  const liveRank = active >= 6 ? Math.max(1, demo.rank - (running ? 2 : 0)) : demo.rank;
  const sequenceProgress = active < 0 ? 0 : ((active + 1) / steps.length) * 100;

  return (
    <div className="demo-console">
      <div className="demo-head">
        <div><i className="live-dot" /><span>Presentation mode</span></div>
        <button onClick={reset} type="button"><ResetIcon /> Reset</button>
      </div>

      <div className="demo-sequence-progress"><motion.span animate={{ width: `${sequenceProgress}%` }} /></div>

      <div className="demo-stats">
        {[
          ["Safety score", liveScore],
          ["XP earned", `+${liveXp}`],
          ["Distance", `${liveDistance.toFixed(1)} km`],
          ["City rank", `#${liveRank}`],
        ].map(([label, value], index) => (
          <motion.article
            key={label}
            animate={{ borderColor: active >= [3, 4, 2, 6][index] ? "rgba(34,197,94,.28)" : "rgba(255,255,255,.06)" }}
          >
            <span>{label}</span>
            <motion.strong key={String(value)} initial={{ opacity: 0.35, y: 6 }} animate={{ opacity: 1, y: 0 }}>{value}</motion.strong>
          </motion.article>
        ))}
      </div>

      <div className="demo-timeline">
        {steps.map(([title, description], index) => {
          const done = index <= active;
          const current = index === active;
          return (
            <motion.div
              key={title}
              animate={{ opacity: done ? 1 : 0.32, x: current ? 5 : 0 }}
              className={`${done ? "done" : ""} ${current ? "current" : ""}`}
            >
              <span>{done && <CheckIcon />}</span>
              <div><strong>{title}</strong><small>{description}</small></div>
              {current && <motion.i className="timeline-pulse" layoutId="timeline-pulse" />}
            </motion.div>
          );
        })}
      </div>

      <button className="demo-run" onClick={run} disabled={running} type="button">
        <PlayIcon /> {running ? `Running step ${Math.max(1, active + 1)} of ${steps.length}…` : active === steps.length - 1 ? "Replay full safe-trip demo" : "Run full safe-trip demo"}
      </button>

      <div className="reward-readout"><span>Reward progress</span><b>{demo.rewardProgress}%</b></div>
      <div className="progress-track"><motion.div className="progress-fill" animate={{ width: `${demo.rewardProgress}%` }} /></div>
    </div>
  );
}
