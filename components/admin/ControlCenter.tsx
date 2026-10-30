"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Activity, AlertTriangle, ArrowUpRight, BarChart3, CheckCircle2,
  ChevronRight, ClipboardList, Cloud, Database, ExternalLink,
  LayoutDashboard, Lock, RefreshCcw, Route, Search, Server,
  Settings, ShieldCheck, SlidersHorizontal, Users,
} from "lucide-react";
import type { AdminRole } from "@/lib/server/adminBridge";

type Section = "overview" | "users" | "trips" | "xp" | "team" | "config" | "audit" | "system";
type ApiResponse = Record<string, any>;

const NAV: { id: Section; label: string; icon: typeof LayoutDashboard; roles: AdminRole[] }[] = [
  { id: "overview", label: "Command Center", icon: LayoutDashboard, roles: ["OWNER","ADMIN","SUPPORT","ANALYST","AUDITOR"] },
  { id: "users", label: "People & Accounts", icon: Users, roles: ["OWNER","ADMIN","SUPPORT"] },
  { id: "trips", label: "Trips & Diagnostics", icon: Route, roles: ["OWNER","ADMIN","SUPPORT","ANALYST","AUDITOR"] },
  { id: "xp", label: "Safety & XP Ledger", icon: BarChart3, roles: ["OWNER","ADMIN","ANALYST"] },
  { id: "team", label: "Team Access", icon: ShieldCheck, roles: ["OWNER","ADMIN","AUDITOR"] },
  { id: "config", label: "Releases & Configuration", icon: SlidersHorizontal, roles: ["OWNER","ADMIN","AUDITOR"] },
  { id: "audit", label: "Audit History", icon: ClipboardList, roles: ["OWNER","ADMIN","AUDITOR"] },
  { id: "system", label: "Infrastructure", icon: Server, roles: ["OWNER","ADMIN","SUPPORT","ANALYST","AUDITOR"] },
];

const CONFIG_KEYS = [
  { key: "maintenance_mode", label: "Maintenance mode", value: { enabled: false, message: "" } },
  { key: "minimum_app_version", label: "Minimum Android version", value: { versionName: "2.7.0-beta.4.2", versionCode: 30, force: false } },
  { key: "feature_flags", label: "Feature flags", value: { new_onboarding: false, remote_update_prompt: true, rules_engine_v2: false, trip_diagnostics: true, ios_companion: true } },
  { key: "pilot_controls", label: "Pilot controls", value: { android_pilot_enabled: true, web_gps_preview_enabled: false, automatic_updates_enabled: true } },
];

function date(value: unknown) {
  if (!value) return "—";
  const d = new Date(String(value));
  return Number.isFinite(d.getTime()) ? d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
}
function number(value: unknown) {
  return Number(value ?? 0).toLocaleString("en-IN");
}
function statusClass(value: unknown) {
  const s = String(value ?? "").toUpperCase();
  if (["ACTIVE","SUCCESS","SYNCED","CONFIRMED","OK"].includes(s)) return "cc-pill good";
  if (["SUSPENDED","FAILED","REJECTED","ERROR","REVOKED","DEGRADED"].includes(s)) return "cc-pill bad";
  return "cc-pill neutral";
}
async function request(path: string, init: RequestInit = {}): Promise<ApiResponse> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "The operation could not be completed.");
  return body;
}

export function ControlCenter({ role }: { role: AdminRole }) {
  const [section, setSection] = useState<Section>("overview");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [detail, setDetail] = useState<ApiResponse | null>(null);
  const [detailKind, setDetailKind] = useState<"user" | "trip" | null>(null);
  const [detailId, setDetailId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newMemberId, setNewMemberId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<AdminRole>("SUPPORT");
  const [configKey, setConfigKey] = useState("maintenance_mode");
  const [configJson, setConfigJson] = useState(JSON.stringify(CONFIG_KEYS[0].value, null, 2));
  const [configReason, setConfigReason] = useState("");
  const [configVersion, setConfigVersion] = useState(0);

  const load = useCallback(async (target: Section = section, silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      let path = `/api/admin/${target}`;
      if (target === "users") {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (statusFilter) params.set("status", statusFilter);
        path += `?${params.toString()}`;
      }
      const result = await request(path);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load this section.");
      if (!silent) setData(null);
    } finally {
      setLoading(false);
    }
  }, [section, query, statusFilter]);

  useEffect(() => { void load(section); /* search inputs are submitted explicitly */ }, [section]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && section === "overview") void load("overview", true);
    }, 60000);
    return () => window.clearInterval(timer);
  }, [section, load]);

  async function openUser(id: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await request(`/api/admin/users/${encodeURIComponent(id)}`);
      setDetail(result); setDetailKind("user"); setDetailId(id);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load account."); }
    finally { setBusy(false); }
  }
  async function openTrip(id: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await request(`/api/admin/trips/${encodeURIComponent(id)}/diagnostics`);
      setDetail(result); setDetailKind("trip"); setDetailId(id);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load diagnostics."); }
    finally { setBusy(false); }
  }
  async function changeUserStatus(user: any) {
    const next = user.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    const reason = window.prompt(next === "SUSPENDED" ? "Reason for suspending this account (minimum 8 characters):" : "Reason for restoring this account (minimum 8 characters):");
    if (!reason || reason.trim().length < 8) return;
    if (!window.confirm(`${next === "SUSPENDED" ? "Suspend" : "Restore"} this account? ${next === "SUSPENDED" ? "Active refresh sessions will also be revoked." : ""}`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await request(`/api/admin/users/${user.id}/status`, { method: "PATCH", body: JSON.stringify({ status: next, reason }) });
      setNotice(`Account status changed to ${next}.`);
      await load("users", true);
      if (detailKind === "user" && detailId === user.id) await openUser(user.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Account update failed."); }
    finally { setBusy(false); }
  }
  async function revokeSessions(user: any) {
    const reason = window.prompt("Reason for revoking all active sessions (minimum 8 characters):");
    if (!reason || reason.trim().length < 8) return;
    if (!window.confirm("Revoke every active refresh session for this account?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await request(`/api/admin/users/${user.id}/revoke-sessions`, { method: "POST", body: JSON.stringify({ reason }) });
      setNotice(`Revoked ${number(result.revokedSessions)} active sessions.`);
      await openUser(user.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Session revocation failed."); }
    finally { setBusy(false); }
  }
  async function addTeamMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = window.prompt("Reason for granting team access (minimum 8 characters):");
    if (!reason || reason.trim().length < 8) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await request("/api/admin/team", { method: "POST", body: JSON.stringify({ userId: newMemberId.trim(), role: newMemberRole, reason }) });
      setNewMemberId("");
      setNotice("Team membership granted. The invited person must sign in and complete MFA.");
      await load("team", true);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to add team member."); }
    finally { setBusy(false); }
  }
  async function updateMember(member: any, status?: string, nextRole?: AdminRole) {
    const reason = window.prompt("Reason for this access change (minimum 8 characters):");
    if (!reason || reason.trim().length < 8) return;
    if (!window.confirm("Apply this team permission change?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await request(`/api/admin/team/${member.user_id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...(status ? { status } : {}), ...(nextRole ? { role: nextRole } : {}), reason }),
      });
      setNotice("Team permissions updated and recorded in the audit history.");
      await load("team", true);
    } catch (e) { setError(e instanceof Error ? e.message : "Team update failed."); }
    finally { setBusy(false); }
  }
  function selectConfig(key: string) {
    setConfigKey(key);
    const current = (data?.configs ?? []).find((item: any) => item.config_key === key);
    const fallback = CONFIG_KEYS.find(item => item.key === key)?.value ?? {};
    setConfigJson(JSON.stringify(current?.config_value ?? fallback, null, 2));
    setConfigVersion(Number(current?.version ?? 0));
    setConfigReason("");
  }
  async function saveConfig(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let value: unknown;
    try { value = JSON.parse(configJson); }
    catch { setError("Configuration must be valid JSON."); return; }
    if (configReason.trim().length < 8) { setError("Enter a reason of at least 8 characters."); return; }
    if (!window.confirm("Save this configuration version? The change will be recorded in the audit history.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await request(`/api/admin/config/${configKey}`, {
        method: "PUT",
        body: JSON.stringify({ value, reason: configReason, expectedVersion: configVersion }),
      });
      setNotice(`Saved ${configKey} as version ${result.config?.version ?? "new"}.`);
      await load("config", true);
      setConfigVersion(Number(result.config?.version ?? configVersion + 1));
    } catch (e) { setError(e instanceof Error ? e.message : "Configuration save failed."); }
    finally { setBusy(false); }
  }

  const visibleNav = NAV.filter(item => item.roles.includes(role));
  const cards = data?.totals ? [
    ["Android users", data.totals.users, Users],
    ["Recorded trips", data.totals.trips, Route],
    ["Driving events", data.totals.events, Activity],
    ["Telemetry uploads", data.totals.telemetryUploads, Database],
    ["Sync issues", data.totals.syncIssues, AlertTriangle],
  ] as const : [];

  return (
    <div className="cc-app">
      <aside className="cc-sidebar">
        <div className="cc-brand">
          <div className="cc-brand-mark"><ShieldCheck size={21}/></div>
          <div><strong>CrediSafe</strong><span>OPERATIONS CENTER</span></div>
        </div>
        <div className="cc-sidebar-label">WORKSPACE</div>
        <nav className="cc-nav" aria-label="Admin sections">
          {visibleNav.map(item => {
            const Icon = item.icon;
            return <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => { setSection(item.id); setDetail(null); setDetailKind(null); setNotice(""); }}>
              <Icon size={17}/><span>{item.label}</span>{section === item.id && <ChevronRight size={15}/>}
            </button>;
          })}
        </nav>
        <div className="cc-sidebar-bottom">
          <div className="cc-role"><Lock size={14}/><span>{role} ACCESS</span></div>
          <a href="/team/security"><Settings size={15}/> Team security</a>
          <a href="/"><ExternalLink size={15}/> Public website</a>
        </div>
      </aside>

      <main className="cc-main">
        <header className="cc-topbar">
          <div><span className="cc-breadcrumb">CrediSafe</span><ChevronRight size={13}/><strong>{NAV.find(n=>n.id===section)?.label ?? "Operations"}</strong></div>
          <div className="cc-topbar-actions">
            <span className="cc-role-chip"><ShieldCheck size={13}/>{role}</span>
            <button className="cc-refresh" onClick={()=>void load(section)} disabled={loading || busy}><RefreshCcw size={15}/> Refresh</button>
          </div>
        </header>

        <div className="cc-content">
          <section className="cc-page-heading">
            <div>
              <div className="cc-kicker">SECURE OPERATIONS / {section.toUpperCase()}</div>
              <h1>{section === "overview" ? "Good operations start with visibility." : NAV.find(n=>n.id===section)?.label}</h1>
              <p>{section === "overview" ? "A verified, real-time view of CrediSafe's Android pilot and connected services." : "Operational tools with role-based access, audit trails and privacy safeguards."}</p>
            </div>
            <div className="cc-heading-actions">
              <span className="cc-live"><span/> LIVE DATA</span>
              <a href="https://github.com/18-monarch/CrediSafe" target="_blank" rel="noreferrer">Website repo <ArrowUpRight size={13}/></a>
              <a href="https://github.com/18-monarch/CrediSafeAndroid" target="_blank" rel="noreferrer">Android repo <ArrowUpRight size={13}/></a>
            </div>
          </section>

          {error && <div className="cc-banner error" role="alert"><AlertTriangle size={17}/>{error}</div>}
          {notice && <div className="cc-banner success" role="status"><CheckCircle2 size={17}/>{notice}</div>}
          {loading && !data && <div className="cc-empty"><RefreshCcw className="cc-spin"/><strong>Loading verified operational data…</strong></div>}

          {section === "overview" && data && <>
            <div className="cc-source">
              <span><span className="cc-dot ok"/> <strong>Android / Neon</strong></span>
              <span>Fetched {date(data.fetchedAt)} · refreshes every 60 seconds while visible</span>
            </div>
            <section className="cc-cards">
              {cards.map(([label,value,Icon])=><article className="cc-card" key={label}>
                <div className="cc-card-top"><span>{label}</span><Icon size={18}/></div>
                <strong>{number(value)}</strong>
              </article>)}
            </section>
            <div className="cc-columns">
              <section className="cc-panel">
                <div className="cc-panel-heading"><div><h2>Trip pipeline</h2><p>Current status distribution</p></div><CheckCircle2 size={19}/></div>
                {(data.tripsByStatus ?? []).length ? data.tripsByStatus.map((row:any)=><div className="cc-breakdown" key={row.status}><span>{row.status}</span><strong>{number(row.count)}</strong></div>) : <p className="cc-muted">No recorded journeys yet.</p>}
              </section>
              <section className="cc-panel">
                <div className="cc-panel-heading"><div><h2>Driving event mix</h2><p>Recorded events by category</p></div><BarChart3 size={19}/></div>
                {(data.eventsByType ?? []).length ? data.eventsByType.map((row:any)=><div className="cc-breakdown" key={row.type}><span>{String(row.type).replaceAll("_"," ").toLowerCase()}</span><strong>{number(row.count)}</strong></div>) : <p className="cc-muted">No uploaded events yet. Zero is not an accuracy result.</p>}
              </section>
            </div>
            <section className="cc-panel">
              <div className="cc-panel-heading"><div><h2>Recent journeys</h2><p>De-identified operational summaries</p></div><Route size={19}/></div>
              <div className="cc-table-wrap"><table className="cc-table"><thead><tr><th>Trip</th><th>Started</th><th>Status</th><th>Distance</th><th>Safety</th><th>Telemetry</th><th>Ruleset</th></tr></thead>
                <tbody>{(data.recentTrips ?? []).map((t:any)=><tr key={t.id}><td>{String(t.id).slice(0,8)}…</td><td>{date(t.startedAt)}</td><td><span className={statusClass(t.status)}>{t.status}</span></td><td>{(Number(t.distanceM)/1000).toFixed(2)} km</td><td>{t.safetyScore == null ? "—" : `${t.safetyScore}/100`}</td><td>{t.telemetryQuality == null ? "—" : `${Math.round(t.telemetryQuality*100)}%`}</td><td>{t.engineVersion ?? "—"}</td></tr>)}</tbody>
              </table></div>
            </section>
            <section className="cc-panel">
              <div className="cc-panel-heading"><div><h2>Recent sync issues</h2><p>Investigate retries and failed uploads in Trips & Diagnostics</p></div><Cloud size={19}/></div>
              {(data.recentSyncIssues ?? []).length ? <div className="cc-table-wrap"><table className="cc-table"><thead><tr><th>Trip reference</th><th>Status</th><th>Attempts</th><th>Recorded</th></tr></thead><tbody>{data.recentSyncIssues.map((row:any)=><tr key={row.tripId+row.recordedAt}><td>{String(row.tripId).slice(0,8)}…</td><td><span className={statusClass(row.status)}>{row.status}</span></td><td>{row.attempts}</td><td>{date(row.recordedAt)}</td></tr>)}</tbody></table></div> : <p className="cc-muted">No recorded sync issues.</p>}
            </section>
          </>}

          {section === "users" && data && <>
            <section className="cc-panel">
              <div className="cc-panel-heading"><div><h2>Account directory</h2><p>Search using name, email or account ID. Support roles see masked email addresses.</p></div><Users size={19}/></div>
              <div className="cc-filters">
                <div className="cc-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void load("users");}} placeholder="Search users, email or ID"/></div>
                <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select>
                <button className="cc-button" onClick={()=>void load("users")}>Search</button>
              </div>
              <div className="cc-table-wrap"><table className="cc-table"><thead><tr><th>Account</th><th>Email</th><th>Type</th><th>Status</th><th>Level</th><th>Total XP</th><th>Created</th><th></th></tr></thead><tbody>
                {(data.users ?? []).map((u:any)=><tr key={u.id}><td><button className="cc-link" onClick={()=>void openUser(u.id)}>{u.name || String(u.id).slice(0,8)}</button><small className="cc-subid">{String(u.id).slice(0,8)}…</small></td><td>{u.email ?? "—"}</td><td>{u.accountType}</td><td><span className={statusClass(u.status)}>{u.status}</span></td><td>{u.currentLevel}</td><td>{number(u.totalXp)}</td><td>{date(u.createdAt)}</td><td><button className="cc-button secondary" onClick={()=>void openUser(u.id)}>Inspect</button></td></tr>)}
                {!data.users?.length && <tr><td colSpan={8}>No matching accounts.</td></tr>}
              </tbody></table></div>
              <div className="cc-table-foot">Showing {number(data.users?.length)} of {number(data.pagination?.total)} accounts.</div>
            </section>
            {detailKind === "user" && detail?.user && <section className="cc-panel cc-detail">
              <div className="cc-panel-heading"><div><div className="cc-kicker">ACCOUNT DETAIL</div><h2>{detail.user.name || "Driver account"}</h2><p>{detail.user.email} · {detail.user.id}</p></div><button className="cc-button secondary" onClick={()=>{setDetail(null);setDetailKind(null);}}>Close</button></div>
              <div className="cc-cards compact">{[["Status",detail.user.status],["Account type",detail.user.accountType],["Current level",detail.user.currentLevel],["Total XP",number(detail.user.totalXp)],["Trips",number(detail.user.counts?.trips)],["Active sessions",number(detail.user.counts?.activeSessions)]].map(([label,value])=><article className="cc-card" key={label}><small>{label}</small><strong>{value}</strong></article>)}</div>
              {detail.user.status === "SUSPENDED" && <p className="cc-muted">Suspended {date(detail.user.suspendedAt)} · Reason: {detail.user.suspensionReason || "—"}</p>}
              <div className="cc-actions">
                <button className={detail.user.status==="SUSPENDED"?"cc-button":"cc-button danger"} disabled={busy} onClick={()=>void changeUserStatus({id:detail.user.id,status:detail.user.status})}>{detail.user.status==="SUSPENDED"?"Restore account":"Suspend account"}</button>
                <button className="cc-button secondary" disabled={busy} onClick={()=>void revokeSessions({id:detail.user.id})}>Revoke all sessions</button>
              </div>
            </section>}
          </>}

          {section === "trips" && data && <>
            <section className="cc-panel">
              <div className="cc-panel-heading"><div><h2>Journey diagnostics</h2><p>Inspect sync history, telemetry metadata, event evidence and XP decisions. Raw GPS payloads are not exposed.</p></div><Route size={19}/></div>
              <div className="cc-table-wrap"><table className="cc-table"><thead><tr><th>Trip ID</th><th>User ref</th><th>Started</th><th>Status</th><th>Classification</th><th>Distance</th><th>Safety</th><th></th></tr></thead><tbody>
                {(data.trips ?? []).map((t:any)=><tr key={t.id}><td>{String(t.id).slice(0,8)}…</td><td>{String(t.user_id).slice(0,8)}…</td><td>{date(t.started_at)}</td><td><span className={statusClass(t.status)}>{t.status}</span></td><td>{t.trip_classification}</td><td>{(Number(t.distance_m)/1000).toFixed(2)} km</td><td>{t.safety_score ?? "—"}</td><td><button className="cc-button secondary" onClick={()=>void openTrip(t.id)}>Diagnostics</button></td></tr>)}
                {!data.trips?.length && <tr><td colSpan={8}>No journeys found.</td></tr>}
              </tbody></table></div>
            </section>
            {detailKind === "trip" && detail?.trip && <section className="cc-panel cc-detail">
              <div className="cc-panel-heading"><div><div className="cc-kicker">TRIP DIAGNOSTIC REPORT</div><h2>{detail.trip.id}</h2><p>{date(detail.trip.startedAt)} · {detail.trip.classification}</p></div><button className="cc-button secondary" onClick={()=>{setDetail(null);setDetailKind(null);}}>Close</button></div>
              <div className="cc-cards compact">{[["Status",detail.trip.status],["Distance",`${(Number(detail.trip.distanceM)/1000).toFixed(2)} km`],["Duration",`${Math.round(Number(detail.trip.durationMs)/60000)} min`],["Safety score",detail.trip.safetyScore ?? "—"],["Telemetry quality",detail.trip.telemetryQuality==null?"—":`${Math.round(detail.trip.telemetryQuality*100)}%`],["Engine",detail.trip.engineVersion ?? "—"]].map(([label,value])=><article className="cc-card" key={label}><small>{label}</small><strong>{value}</strong></article>)}</div>
              <h3 className="cc-subheading">Synchronization attempts</h3>
              <div className="cc-table-wrap"><table className="cc-table"><thead><tr><th>Status</th><th>Attempts</th><th>Diagnostic (redacted)</th><th>Time</th></tr></thead><tbody>{(detail.sync ?? []).map((s:any,i:number)=><tr key={i}><td>{s.status}</td><td>{s.attempts}</td><td>{s.diagnostic ?? "—"}</td><td>{date(s.recordedAt)}</td></tr>)}</tbody></table></div>
              <h3 className="cc-subheading">XP decision ledger</h3>
              <div className="cc-table-wrap"><table className="cc-table"><thead><tr><th>Category</th><th>Points</th><th>Delta XP</th><th>Reason code</th><th>Ruleset</th></tr></thead><tbody>{(detail.xp ?? []).map((x:any,i:number)=><tr key={i}><td>{x.category}</td><td>{x.points}</td><td>{x.deltaXp ?? "—"}</td><td>{x.reasonCode ?? "—"}</td><td>{x.rulesetVersion ?? "—"}</td></tr>)}</tbody></table></div>
              <h3 className="cc-subheading">Recorded events ({detail.events?.length ?? 0})</h3>
              <div className="cc-breakdown-grid">{(detail.events ?? []).slice(0,40).map((e:any,i:number)=><div className="cc-breakdown" key={i}><span>{e.type} · {e.severity}</span><strong>{Math.round(e.confidence*100)}%</strong></div>)}</div>
            </section>}
          </>}

          {section === "xp" && data && <section className="cc-panel">
            <div className="cc-panel-heading"><div><h2>XP ledger</h2><p>Immutable earning records and ruleset provenance. Adjustments are intentionally not enabled in this version.</p></div><BarChart3 size={19}/></div>
            <div className="cc-table-wrap"><table className="cc-table"><thead><tr><th>Date</th><th>User</th><th>Trip</th><th>Category</th><th>Points</th><th>Delta XP</th><th>Reason code</th><th>Ruleset</th></tr></thead><tbody>{(data.entries ?? []).map((x:any)=><tr key={x.id}><td>{date(x.created_at)}</td><td>{String(x.user_id).slice(0,8)}…</td><td>{x.trip_id?String(x.trip_id).slice(0,8)+"…":"—"}</td><td>{x.category}</td><td>{x.points}</td><td>{x.delta_xp ?? "—"}</td><td>{x.reason_code ?? "—"}</td><td>{x.ruleset_version ?? "—"}</td></tr>)}{!data.entries?.length&&<tr><td colSpan={8}>No XP entries found.</td></tr>}</tbody></table></div>
          </section>}

          {section === "team" && data && <>
            <section className="cc-panel">
              <div className="cc-panel-heading"><div><h2>Team access</h2><p>Only pre-existing Supabase Auth accounts can be granted access. Every member must complete MFA.</p></div><ShieldCheck size={19}/></div>
              {role === "OWNER" && <form className="cc-form-row" onSubmit={addTeamMember}>
                <input value={newMemberId} onChange={e=>setNewMemberId(e.target.value)} placeholder="Supabase Auth user UUID" required/>
                <select value={newMemberRole} onChange={e=>setNewMemberRole(e.target.value as AdminRole)}><option value="ADMIN">Administrator</option><option value="SUPPORT">Support</option><option value="ANALYST">Analyst</option><option value="AUDITOR">Auditor</option></select>
                <button className="cc-button" disabled={busy}>Grant access</button>
              </form>}
              <div className="cc-table-wrap"><table className="cc-table"><thead><tr><th>Auth user UUID</th><th>Role</th><th>Status</th><th>Added</th><th>Actions</th></tr></thead><tbody>
                {(data.members ?? []).map((m:any)=><tr key={m.user_id}><td>{m.user_id}</td><td>{m.role}</td><td><span className={statusClass(m.status)}>{m.status}</span></td><td>{date(m.created_at)}</td><td>{m.role!=="OWNER" && m.status==="ACTIVE" && role==="OWNER" ? <button className="cc-button danger" onClick={()=>void updateMember(m,"REVOKED")}>Revoke</button> : "—"}</td></tr>)}
                {!data.members?.length&&<tr><td colSpan={5}>No additional team members have been configured.</td></tr>}
              </tbody></table></div>
              <p className="cc-muted">Owner access is bootstrapped only from the server-side CREDISAFE_ADMIN_USER_IDS allowlist. The last active Owner cannot be revoked or demoted.</p>
            </section>
          </>}

          {section === "config" && data && <>
            <section className="cc-panel">
              <div className="cc-panel-heading"><div><h2>Release metadata & remote configuration</h2><p>Versioned, allowlisted settings only. Native Android changes still require a signed APK release.</p></div><SlidersHorizontal size={19}/></div>
              <div className="cc-config-layout">
                <div className="cc-config-list">{CONFIG_KEYS.map(item=>{const current=(data.configs??[]).find((c:any)=>c.config_key===item.key);return <button className={configKey===item.key?"selected":""} key={item.key} onClick={()=>selectConfig(item.key)}><strong>{item.label}</strong><span>Version {current?.version ?? 0} · {current?"Configured":"Default template"}</span></button>;})}</div>
                <form className="cc-config-editor" onSubmit={saveConfig}>
                  <label>Configuration item<select value={configKey} onChange={e=>selectConfig(e.target.value)}>{CONFIG_KEYS.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
                  <label>JSON value<textarea rows={13} spellCheck={false} value={configJson} onChange={e=>setConfigJson(e.target.value)}/></label>
                  <label>Reason for change<input value={configReason} onChange={e=>setConfigReason(e.target.value)} minLength={8} maxLength={500} placeholder="Explain why this configuration is changing"/></label>
                  <div className="cc-config-meta">Current version: {configVersion} · Changes are versioned and audited.</div>
                  <button className="cc-button" disabled={busy}>Validate & save configuration</button>
                </form>
              </div>
            </section>
          </>}

          {section === "audit" && data && <section className="cc-panel">
            <div className="cc-panel-heading"><div><h2>Administrative audit history</h2><p>Actor, action, target, reason and recorded metadata.</p></div><ClipboardList size={19}/></div>
            <div className="cc-table-wrap"><table className="cc-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Resource</th><th>Reason</th></tr></thead><tbody>{(data.entries??[]).map((entry:any)=><tr key={entry.id}><td>{date(entry.created_at)}</td><td>{String(entry.actor_user_id).slice(0,8)}…</td><td>{entry.action}</td><td>{entry.resource_type} · {entry.resource_id ?? "—"}</td><td>{entry.reason}</td></tr>)}{!data.entries?.length&&<tr><td colSpan={5}>No admin actions have been recorded yet.</td></tr>}</tbody></table></div>
          </section>}

          {section === "system" && data && <>
            <section className="cc-cards compact">
              {Object.entries(data.services ?? {}).map(([key,value]:any)=><article className="cc-card" key={key}><div className="cc-card-top"><span>{key}</span><CheckCircle2 size={16}/></div><strong className="cc-status-value">{value.status}</strong><small>{value.message}</small></article>)}
            </section>
            <section className="cc-panel"><div className="cc-panel-heading"><div><h2>Infrastructure checks</h2><p>Backend and database checks executed at {date(data.checkedAt)}.</p></div><Server size={19}/></div>
              <div className="cc-breakdown-grid">{Object.entries(data.counts ?? {}).map(([key,value])=><div className="cc-breakdown" key={key}><span>{key.replaceAll(/([A-Z])/g," $1")}</span><strong>{number(value)}</strong></div>)}</div>
              <p className="cc-muted">This check verifies the Render process and Neon queries. It does not independently verify Vercel deployment history or Supabase email delivery.</p>
            </section>
          </>}

          {!loading && !data && !error && <div className="cc-empty"><Cloud size={30}/><strong>No operational data returned</strong><span>Check the server-side admin bridge and database schema.</span></div>}
          <footer className="cc-footer">CrediSafe Operations Center · Data is private and uncached. Sensitive actions require a reason and produce an audit entry. Personal data is disclosed according to role.</footer>
        </div>
      </main>
    </div>
  );
}
