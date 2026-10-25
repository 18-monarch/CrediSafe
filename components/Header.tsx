"use client";

import { useEffect, useState } from "react";

function Brand() {
  return (
    <a href="/" className="brand-logo-link" aria-label="CrediSafe home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/credisafe-logo.png" alt="CrediSafe" className="brand-logo-image" />
    </a>
  );
}

export { Brand };

export function Header() {
  const [isIOS, setIsIOS] = useState(false);
  useEffect(() => {
    setIsIOS(/iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);
  return (
    <header className="site-header">
      <Brand />
      <nav className="hidden items-center gap-7 text-[13px] text-slate-300 lg:flex" aria-label="Primary navigation">
        <a href="#journey">Journey</a>
        <a href="#progression">Progress</a>
        <a href="#rewards">Rewards</a>
        <a href="#leaderboard">Leaderboard</a>
        <a href="#integrations">Intelligence</a>
        <a href="#pilot">Pilot</a>
      </nav>
      <a
        href={isIOS ? "/ios" : "https://github.com/18-monarch/CrediSafeAndroid/releases/download/v2.7.0-beta.4.1/CrediSafe-2.7.0-beta.4.1.apk"}
        className="primary-button compact header-app-link"
        aria-label={isIOS ? "Open CrediSafe iPhone web companion" : "Download CrediSafe v2.7.0 Beta 4.1 signed Android APK"}
      >
        <span className="header-desktop-label">{isIOS ? "Use on iPhone" : "Download Beta 4.1 APK"}</span>
        <span className="header-mobile-label">{isIOS ? "Web App" : "Get APK"}</span>
      </a>
    </header>
  );
}
