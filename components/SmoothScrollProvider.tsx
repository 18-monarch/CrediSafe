"use client";

import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const touchLayout = window.matchMedia("(max-width: 900px), (pointer: coarse)").matches;

    // Native scrolling is more predictable and responsive on phones and tablets.
    // Lenis remains enabled for the desktop cinematic presentation only.
    if (reducedMotion || touchLayout) {
      ScrollTrigger.refresh();
      return;
    }

    const lenis = new Lenis({
      duration: 1.08,
      smoothWheel: true,
      syncTouch: false,
      touchMultiplier: 1.05,
      anchors: true,
    });

    const handleScroll = () => ScrollTrigger.update();
    const handleTick = (time: number) => lenis.raf(time * 1000);

    lenis.on("scroll", handleScroll);
    gsap.ticker.add(handleTick);
    gsap.ticker.lagSmoothing(0);

    const refresh = () => ScrollTrigger.refresh();
    document.fonts.ready.then(refresh).catch(() => undefined);
    window.addEventListener("load", refresh, { once: true });

    return () => {
      window.removeEventListener("load", refresh);
      lenis.off("scroll", handleScroll);
      gsap.ticker.remove(handleTick);
      lenis.destroy();
    };
  }, []);

  return children;
}
