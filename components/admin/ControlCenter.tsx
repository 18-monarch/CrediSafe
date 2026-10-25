"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity, AlertTriangle, ArrowUpRight, BarChart3, CheckCircle2, Cloud,
  Database, RefreshCcw, Route, ShieldCheck, Smartphone, Users,
} from "lucide-react";

type CountRow = { status?: string; type?: string; count: number };
type Journey = {
  id: string; startedAt: string; durationMs: number; distanceM: number;
  safetyScore: number | null; telemetryQuality: number | null;
  status: string; engineVersion: string | null;
};
type SyncIssue = { tripId: string; status: string; attempts: number; recordedAt: string };
type Overview = {
  source: "android-neon"; fetchedAt: string;
  totals: { users: number; trips: number; events: number; telemetryUploads: number; syncIssues: number };
  tripsByStatus: CountRow[]; eventsByType: CountRow[];
  recentTrips: Journey[]; recentSyncIssues: SyncIssue[];
  privacy: string;
};

function displayDate(value: string | null | undefined) {
  const d = new Date(value ?? "");
  return Number.isFinite(d.getTime())
    ? d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "—";
}
function pct(v: number | null) {
  return v == null ? "—" : Math.round(v * 100) + "%";
}

export function ControlCenter() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [rechecking, setRechecking] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRechecking(true);
    try {
      const r = await fetch("/api/admin/overview", { cache: "no-store", credentials: "same-origin" });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Monitoring unavailable");
      setData(body as Overview);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to refresh monitoring");
      if (!silent) setData(null);
    } finally {
      setLoading(false);
      setRechecking(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const cards = data ? [
    { label: "Android users", value: data.totals.users, icon: Users, detail: "Cloud accounts" },
    { label: "Recorded trips", value: data.totals.trips, icon: Route, detail: "Neon journeys" },
    { label: "Driving events", value: data.totals.events, icon: Activity, detail: "Stored events" },
    { label: "Telemetry uploads", value: data.totals.telemetryUploads, icon: Database, detail: "Evidence assets" },
    { label: "Sync issues", value: data.totals.syncIssues, icon: AlertTriangle, detail: "Audit records to review" },
  ] : [];

  return (
    <main className="cc-content">
      <header className="cc-header">
        <div className="cc-brand">
          <div className="cc-brand-mark"><ShieldCheck size={22} /></div>
          <div><strong>CrediSafe</strong><span>Team Control Center · Private</span></div>
        </div>
        <div className="cc-header-actions">
          <Link href="/app/dashboard">Driver app <ArrowUpRight size={14}/></Link>
          <Link href="/">Website <ArrowUpRight size={14}/></Link>
        </div>
      </header>
      <section className="cc-heading">
        <div>
          <div className="cc-kicker">Operations / Android pilot</div>
          <h1>Drive intelligence, made observable.</h1>
          <p>Real backend metrics for the team. This panel never displays raw GPS tracks or personal contact details.</p>
        </div>
        <button className="cc-refresh" onClick={() => void load(true)} disabled={rechecking || loading}>
          <RefreshCcw size={16} className={rechecking ? "cc-spin" : ""}/> Refresh
        </button>
      </section>

      <div className="cc-source">
        <div><span className={data && !error ? "cc-dot ok" : "cc-dot"}/><strong>Android / Neon</strong>
          <span>{data ? "Last updated " + displayDate(data.fetchedAt) : "Connection not established"}</span>
        </div>
        <span>Web / Supabase metrics: Not connected to unified reporting</span>
      </div>

      {error && <div className="cc-error" role="alert"><AlertTriangle size={18}/><span>{error}. No substitute or simulated metrics are shown.</span></div>}
      {loading && !data && <div className="cc-empty">Loading authenticated operational metrics…</div>}
      {!loading && !data && <div className="cc-empty">
        <Cloud size={28}/>
        <h2>Monitoring needs configuration</h2>
        <p>Admin access is secure, but Android metrics require a shared server-only bridge secret on Vercel and Render. See the setup guide.</p>
        <Link href="https://github.com/18-monarch/CrediSafe/blob/main/docs/WEB_PLATFORM_V3.md" target="_blank">View setup guide</Link>
      </div>}

      {data && <>
        <section className="cc-cards" aria-label="Real pilot metrics">
          {cards.map(item => <article className="cc-card" key={item.label}>
            <div className="cc-card-top"><span>{item.label}</span><item.icon size={18}/></div>
            <strong>{item.value.toLocaleString("en-IN")}</strong>
            <small>{item.detail}</small>
          </article>)}
        </section>
        <div className="cc-columns">
          <section className="cc-panel">
            <div className="cc-panel-heading"><div><h2>Journey verification</h2><p>Current trip statuses in Neon</p></div><CheckCircle2 size={19}/></div>
            {data.tripsByStatus.length ? data.tripsByStatus.map(row => <div className="cc-breakdown" key={row.status}>
              <span>{row.status}</span><strong>{Number(row.count).toLocaleString("en-IN")}</strong>
            </div>) : <p className="cc-muted">No recorded Android journeys yet.</p>}
          </section>
          <section className="cc-panel">
            <div className="cc-panel-heading"><div><h2>Rules Engine v2</h2><p>Detected events by category</p></div><BarChart3 size={19}/></div>
            {data.eventsByType.length ? data.eventsByType.map(row => <div className="cc-breakdown" key={row.type}>
              <span>{row.type?.replaceAll("_", " ").toLowerCase()}</span><strong>{Number(row.count).toLocaleString("en-IN")}</strong>
            </div>) : <p className="cc-muted">No events have been uploaded yet. Zero is not an accuracy result.</p>}
          </section>
        </div>
        <section className="cc-panel">
          <div className="cc-panel-heading"><div><h2>Recent Android journeys</h2><p>Only operational fields; no user identity or coordinates</p></div><Smartphone size={19}/></div>
          <div className="cc-table-wrap"><table className="cc-table">
            <thead><tr><th>Recorded</th><th>Status</th><th>Distance</th><th>Safety</th><th>Telemetry</th><th>Ruleset</th></tr></thead>
            <tbody>{data.recentTrips.length ? data.recentTrips.map(t=><tr key={t.id}>
              <td>{displayDate(t.startedAt)}</td><td><span className="cc-status">{t.status}</span></td>
              <td>{(t.distanceM/1000).toFixed(2)} km</td>
              <td>{t.safetyScore==null?"—":t.safetyScore+"/100"}</td><td>{pct(t.telemetryQuality)}</td>
              <td>{t.engineVersion ?? "—"}</td>
            </tr>) : <tr><td colSpan={6}>No journeys recorded in the Android cloud.</td></tr>}</tbody>
          </table></div>
        </section>
        <section className="cc-panel">
          <div className="cc-panel-heading"><div><h2>Sync audit</h2><p>Recent items that may require investigation</p></div><Cloud size={19}/></div>
          {data.recentSyncIssues.length ? <div className="cc-table-wrap"><table className="cc-table">
            <thead><tr><th>Trip reference</th><th>Status</th><th>Attempts</th><th>Observed</th></tr></thead>
            <tbody>{data.recentSyncIssues.map(v=><tr key={v.tripId+v.recordedAt}>
              <td>{v.tripId.slice(0,8)}…</td><td>{v.status}</td><td>{v.attempts}</td><td>{displayDate(v.recordedAt)}</td>
            </tr>)}</tbody>
          </table></div> : <p className="cc-muted">No recorded sync issues in the audit table.</p>}
        </section>
        <footer className="cc-footer">Source: {data.source}. Data freshness depends on completed uploads and backend availability. The panel does not establish sensor precision, safety validity or pilot consent.</footer>
      </>}
    </main>
  );
}
