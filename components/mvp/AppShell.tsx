"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Award,
  Camera,
  CarFront,
  Gauge,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { MvpProvider, useMvp } from "./MvpProvider";

const nav = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/trip", label: "Start a trip", icon: Gauge },
  { href: "/app/trips", label: "Trip history", icon: History },
  { href: "/app/vision", label: "Video verification", icon: Camera },
  { href: "/app/rewards", label: "Rewards", icon: Award },
  { href: "/app/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/app/profile", label: "Profile & vehicle", icon: UserRound },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <MvpProvider>
      <Shell>{children}</Shell>
    </MvpProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { snapshot, message, clearMessage } = useMvp();

  async function signOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mvp-root">
      <aside className={`mvp-sidebar ${open ? "open" : ""}`}>
        <div className="mvp-sidebar-head">
          <Link className="mvp-brand mvp-brand-logo" href="/" aria-label="CrediSafe home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/credisafe-logo.png" alt="CrediSafe" />
          </Link>
          <button className="mvp-icon-button mobile-only" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>

        <nav className="mvp-nav" aria-label="Product navigation">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link key={item.href} className={active ? "active" : ""} href={item.href} onClick={() => setOpen(false)}>
                <Icon size={19} /><span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mvp-sidebar-foot">
          <div className="mvp-mode-card">
            <span className={`mvp-status-dot ${snapshot.backendMode === "supabase" ? "live" : "demo"}`} />
            <div>
              <strong>{snapshot.backendMode === "supabase" ? "Supabase connected" : "Local mode"}</strong>
              <small>{snapshot.backendMode === "supabase" ? "Secure cloud persistence" : "Stored on this device"}</small>
            </div>
          </div>
          <button className="mvp-nav-action" onClick={signOut}><LogOut size={18} /> Exit CrediSafe</button>
        </div>
      </aside>

      {open && <button className="mvp-sidebar-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} />}

      <div className="mvp-main-column">
        <header className="mvp-topbar">
          <button className="mvp-icon-button mobile-only" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
          <div className="mvp-topbar-context">
            <CarFront size={18} />
            <span>{snapshot.vehicles.find((vehicle) => vehicle.isPrimary)?.registrationNumber ?? "No vehicle added"}</span>
          </div>
          <div className="mvp-driver-pill">
            <span>{snapshot.profile.fullName.slice(0, 1).toUpperCase()}</span>
            <div><strong>{snapshot.profile.fullName}</strong><small>{snapshot.profile.level} · {snapshot.profile.totalXp.toLocaleString("en-IN")} XP</small></div>
          </div>
        </header>

        {message && (
          <div className="mvp-notice" role="status">
            <span>{message}</span>
            <button onClick={clearMessage}>Dismiss</button>
          </div>
        )}

        <main className="mvp-content">{children}</main>
      </div>
    </div>
  );
}
