"use client";

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
      <a href="/app/dashboard" className="primary-button compact header-app-link">
        <span className="header-desktop-label">Open CrediSafe</span>
        <span className="header-mobile-label">Open app</span>
      </a>
    </header>
  );
}
