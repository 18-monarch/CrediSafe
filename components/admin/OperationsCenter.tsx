"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BadgeCheck, BarChart3,
  Bell, CheckCircle2, ChevronRight, CircleHelp, Cloud, Database, Download,
  FileClock, Gauge, KeyRound, LayoutDashboard, Lock, LogOut, RefreshCw,
  Route, Search, Settings2, Shield, ShieldAlert, Smartphone, SlidersHorizontal,
  Users, Wallet, Wrench, X, Zap,
} from "lucide-react";

type Section = "overview" | "users" | "trips" | "xp" | "releases" | "config" | "health" | "audit" | "team";
type Role = "OWNER" | "ADMIN" | "SUPPORT" | "ANALYST" | "AUDITOR";
type AnyRecord = Record<string, any>;

const navigation: { id: Section; label: string; group: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Command center", group: "OPERATIONS", icon: LayoutDashboard },
  { id: "users", label: "People & accounts", group: "OPERATIONS", icon: Users },
  { id: "trips", label: "Trips & diagnostics", group: "OPERATIONS", icon: Route },
  { id: "xp", label: "Safety & XP ledger", group: "OPERATIONS", icon: Wallet },
  { id: "releases", label: "App & releases", group: "PRODUCT", icon: Smartphone },
  { id: "config", label: "Remote configuration", group: "PRODUCT", icon: SlidersHorizontal },
  { id: "health", label: "Infrastructure", group: "PLATFORM", icon: Activity },
  { id: "audit", label: "Security & audit", group: "PLATFORM", icon: FileClock },
  { id: "team", label: "Team & permissions", group: "PLATFORM", icon: Shield },
];

const roleDescriptions: Record<Role, string> = {
  OWNER: "Full platform control, including team governance and XP adjustments.",
  ADMIN: "Operational account controls and approved configuration changes.",
  SUPPORT: "User and trip investigation, plus session revocation.",
  ANALYST: "Read-only operational and XP analytics.",
  AUDITOR: "Read-only access to the audit history and trip verification.",
};

function number(value: unknown) { return Number(value || 0).toLocaleString("en-IN"); }
function date(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
function shortId(value?: string) { return value ? value.slice(0, 8) + "…" : "—"; }
function statusClass(value?: string) {
  const s = String(value || "").toUpperCase();
  if (["ACTIVE", "SYNCED", "VALIDATED", "CONFIRMED", "OK"].includes(s)) return "ops-pill good";
  if (["SUSPENDED", "REJECTED", "FAILED", "DOWN", "REVOKED"].includes(s)) return "ops-pill bad";
  return "ops-pill warn";
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="ops-empty"><CircleHelp size={24}/><strong>{title}</strong><span>{detail}</span></div>;
}

function Metric({ label, value, detail, icon: Icon, tone = "mint" }: {
  label: string; value: unknown; detail: string; icon: typeof Users; tone?: string;
}) {
  return <article className="ops-metric">
    <div className="ops-metric-top"><span>{label}</span><span className={"ops-icon " + tone}><Icon size={17}/></span></div>
    <strong>{number(value)}</strong><small>{detail}</small>
  </article>;
}

export function OperationsCenter() {
  const [section, setSection] = useState<Section>("overview");
  const [role, setRole] = useState<Role>("AUDITOR");
  const [data, setData] = useState<AnyRecord>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<AnyRecord | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<AnyRecord | null>(null);
  const [modal, setModal] = useState<AnyRecord | null>(null);
  const [reason, setReason] = useState("");
  const [delta, setDelta] = useState("10");
  const [teamUserId, setTeamUserId] = useState("");
  const [teamRole, setTeamRole] = useState<Role>("SUPPORT");
  const [configValues, setConfigValues] = useState<AnyRecord>({});
  const [configJson, setConfigJson] = useState("{ }");

  const can = (roles: Role[]) => roles.includes(role);

  const load = useCallback(async (resource: Section, query = "") => {
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({ resource });
      if (query && resource === "users") params.set("q", query);
      if (query && resource === "trips") params.set("q", query);
      const response = await fetch("/api/admin/operations?" + params.toString(), {
        cache: "no-store", credentials: "same-origin",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load this section.");
      setData(payload);
      if (payload.adminRole && ["OWNER", "ADMIN", "SUPPORT", "ANALYST", "AUDITOR"].includes(payload.adminRole)) {
        setRole(payload.adminRole);
      }
      if (resource === "config") {
        const values: AnyRecord = {};
        for (const item of payload.configuration || []) values[item.config_key] = item.config_value;
        setConfigValues(values);
        setConfigJson(JSON.stringify(values.feature_flags || {}, null, 2));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Admin data could not be loaded.");
      setData({});
    } finally { setBusy(false); }
  }, []);

  useEffect(() => { void load(section); }, [section, load]);

  const submitAction = useCallback(async (action: string, fields: AnyRecord) => {
    if (reason.trim().length < 8) { setError("Please provide a meaningful reason (at least 8 characters)."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/operations", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...fields, reason: reason.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The operation failed.");
      setModal(null); setReason(""); setNotice(payload.duplicate ? "This adjustment was already applied; no duplicate was created." : "Operation completed and recorded in the audit log.");
      await load(section, search);
      if (selectedUser?.id && section === "users") {
        const details = await fetch("/api/admin/operations?resource=user&id=" + selectedUser.id, { cache: "no-store" }).then(r => r.json());
        if (details.user) setSelectedUser(details);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Operation failed."); }
    finally { setBusy(false); }
  }, [reason, load, section, search, selectedUser]);

  const reload = () => void load(section, search);
  const groupedNav = useMemo(() => ["OPERATIONS", "PRODUCT", "PLATFORM"].map(group => ({
    group, items: navigation.filter(item => item.group === group),
  })), []);

  const openUser = async (id: string) => {
    setBusy(true); setError(""); setSelectedTrip(null);
    try {
      const response = await fetch("/api/admin/operations?resource=user&id=" + encodeURIComponent(id), { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load user.");
      setSelectedUser(payload);
    } catch (e) { setError(e instanceof Error ? e.message : "User details unavailable."); }
    finally { setBusy(false); }
  };
  const openTrip = async (id: string) => {
    setBusy(true); setError(""); setSelectedUser(null);
    try {
      const response = await fetch("/api/admin/operations?resource=trip&id=" + encodeURIComponent(id), { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load trip.");
      setSelectedTrip(payload);
    } catch (e) { setError(e instanceof Error ? e.message : "Trip diagnostics unavailable."); }
    finally { setBusy(false); }
  };

  const title = navigation.find(n => n.id === section)?.label || "Command center";

  return <div className="ops-shell">
    <aside className="ops-sidebar">
      <a className="ops-brand" href="/" aria-label="CrediSafe home">
        <span className="ops-brand-mark"><Shield size={21}/></span>
        <span><strong>CrediSafe</strong><small>OPERATIONS CENTER</small></span>
      </a>
      <div className="ops-side-status"><span className="ops-live-dot"/> PRIVATE TEAM AREA</div>
      <nav className="ops-nav" aria-label="Admin navigation">
        {groupedNav.map(group => <div className="ops-nav-group" key={group.group}>
          <div className="ops-nav-label">{group.group}</div>
          {group.items.map(item => {
            const Icon = item.icon;
            return <button key={item.id} className={"ops-nav-item " + (section === item.id ? "active" : "")}
              onClick={() => { setSection(item.id); setSelectedUser(null); setSelectedTrip(null); setSearch(""); setNotice(""); }}>
              <Icon size={17}/><span>{item.label}</span>{section === item.id && <ChevronRight size={15}/>}
            </button>;
          })}
        </div>)}
      </nav>
      <div className="ops-sidebar-bottom">
        <div className="ops-role-card"><span className="ops-role-icon"><Lock size={15}/></span><div><strong>{role}</strong><small>Verified team role · MFA required</small></div></div>
        <a className="ops-side-link" href="/team/security"><KeyRound size={15}/> Security settings</a>
        <a className="ops-side-link" href="/"><LogOut size={15}/> Back to website</a>
      </div>
    </aside>

    <main className="ops-main">
      <header className="ops-topbar">
        <div><div className="ops-breadcrumb">CrediSafe <span>/</span> Operations <span>/</span> <strong>{title}</strong></div>
          <div className="ops-top-sub">Production workspace · Android / Neon + Website / Supabase</div></div>
        <div className="ops-top-actions">
          <span className="ops-role-chip"><ShieldCheckIcon/> {role}</span>
          <button className="ops-icon-button" aria-label="Refresh" onClick={reload} disabled={busy}><RefreshCw size={17} className={busy ? "ops-spin" : ""}/></button>
        </div>
      </header>

      <div className="ops-content">
        <div className="ops-page-heading">
          <div><div className="ops-eyebrow">OPERATIONS / {section.toUpperCase()}</div><h1>{title}</h1>
            <p>{section === "overview" ? "A live operational picture of CrediSafe. Investigate issues and act with appropriate permissions." : sectionDescription(section)}</p></div>
          <div className="ops-heading-meta"><span className="ops-live-dot"/> Live data · no demo metrics</div>
        </div>

        {error && <div className="ops-alert error"><AlertTriangle size={17}/><span>{error}</span><button onClick={() => setError("")}><X size={15}/></button></div>}
        {notice && <div className="ops-alert success"><CheckCircle2 size={17}/><span>{notice}</span><button onClick={() => setNotice("")}><X size={15}/></button></div>}
        {busy && <div className="ops-progress"><span/></div>}

        {section === "overview" && <OverviewPanel data={data} setSection={setSection}/>}
        {section === "users" && <section className="ops-panel">
          <div className="ops-panel-head"><div><h2>Account directory</h2><p>Neon-backed Android identities. Password hashes and tokens are never returned.</p></div>
            <span className="ops-count">{data.count ?? 0} results</span></div>
          <SearchBar value={search} onChange={setSearch} onSubmit={() => void load("users", search)} placeholder="Search by name, email or account UUID"/>
          <DataTable headers={["Account","Type","Status","Level","Total XP","Created"]} rows={(data.users || []).map((u: AnyRecord) => [
            <button className="ops-text-button" key="user" onClick={() => void openUser(u.id)}><strong>{u.name || "Unnamed account"}</strong><small>{u.email || shortId(u.id)}</small></button>,
            u.account_type, <span className={statusClass(u.account_status)}>{u.account_status}</span>,
            u.current_level, number(u.total_xp), date(u.created_at),
          ])} empty="No matching accounts."/>
        </section>}

        {section === "trips" && <section className="ops-panel">
          <div className="ops-panel-head"><div><h2>Journey diagnostics</h2><p>Search and inspect trip processing, verification and synchronization.</p></div><span className="ops-count">{data.count ?? 0} journeys</span></div>
          <SearchBar value={search} onChange={setSearch} onSubmit={() => void load("trips", search)} placeholder="Search trip ID, user ID or account name"/>
          <DataTable headers={["Trip","Driver","Status","Distance","Safety","Telemetry","Engine"]} rows={(data.trips || []).map((t: AnyRecord) => [
            <button className="ops-text-button" key="trip" onClick={() => void openTrip(t.id)}><strong>{shortId(t.id)}</strong><small>{date(t.started_at)}</small></button>,
            t.user_name || shortId(t.user_id),
            <span className={statusClass(t.status)}>{t.status}</span>,
            (Number(t.distance_m || 0) / 1000).toFixed(2) + " km",
            t.safety_score == null ? "—" : t.safety_score + "/100",
            t.telemetry_quality == null ? "—" : Math.round(t.telemetry_quality * 100) + "%",
            t.engine_version || "—",
          ])} empty="No journeys match this search."/>
        </section>}

        {section === "xp" && <section className="ops-panel">
          <div className="ops-panel-head"><div><h2>XP transaction ledger</h2><p>Append-only awards and administrative adjustments. Corrections never rewrite previous entries.</p></div><span className="ops-count">Latest 100</span></div>
          <DataTable headers={["Date","Account","Source","Delta XP","Reason","Ruleset"]} rows={(data.entries || []).map((e: AnyRecord) => [
            date(e.created_at), <span key="account">{e.user_name || shortId(e.user_id)}<small>{shortId(e.user_id)}</small></span>,
            e.source_type || e.category, <strong className={Number(e.delta_xp ?? e.points) < 0 ? "ops-negative" : "ops-positive"}>{Number(e.delta_xp ?? e.points) > 0 ? "+" : ""}{e.delta_xp ?? e.points}</strong>,
            e.reason || e.reason_code || "—", e.ruleset_version || e.engine_version || "—",
          ])} empty="No XP ledger entries found."/>
          {can(["OWNER"]) && <div className="ops-inline-action"><div><strong>Manual XP correction</strong><small>Owner only · bounded adjustments · immutable ledger entry</small></div>
            <button className="ops-button primary" onClick={() => { setModal({type:"adjust-xp",title:"Adjust XP balance",operationId:crypto.randomUUID()}); setDelta("10"); setReason(""); }}>Create adjustment</button></div>}
        </section>}

        {section === "releases" && <section className="ops-panel">
          <div className="ops-panel-head"><div><h2>Android release history</h2><p>Read-only GitHub release metadata. APK signing and publication remain in the protected CI pipeline.</p></div><span className="ops-count">GitHub Releases</span></div>
          {(data.releases || []).length ? <div className="ops-release-list">{data.releases.map((release: AnyRecord) => <article className="ops-release" key={release.tag}>
            <div className="ops-release-icon"><Smartphone size={21}/></div><div className="ops-release-body"><div className="ops-release-title"><strong>{release.title || release.tag}</strong><span className={release.prerelease ? "ops-pill warn" : "ops-pill good"}>{release.prerelease ? "Prerelease" : "Release"}</span></div>
              <small>{release.tag} · Published {date(release.publishedAt)}</small><div className="ops-asset-list">{(release.assets || []).map((asset: AnyRecord) => <a key={asset.name} href={asset.downloadUrl} target="_blank" rel="noreferrer"><Download size={13}/>{asset.name}<small>{(asset.size / 1048576).toFixed(1)} MB</small></a>)}</div></div>
            <a className="ops-link-button" href={release.url} target="_blank" rel="noreferrer">Release page <ArrowUpRight size={14}/></a>
          </article>)}</div> : <Empty title="No release metadata" detail="Release information is unavailable or no Android releases have been published."/>}
        </section>}

        {section === "config" && <ConfigPanel data={data} role={role} onSave={(key, value) => { setModal({type:"update-config",title:"Update " + key,key,value,operationId:crypto.randomUUID()}); setReason(""); }}/>}
        {section === "health" && <HealthPanel data={data}/>}
        {section === "audit" && <section className="ops-panel">
          <div className="ops-panel-head"><div><h2>Administrative audit history</h2><p>Who did what, when and why. This record is append-only to the application.</p></div><span className="ops-count">{(data.logs || []).length} entries</span></div>
          <DataTable headers={["Timestamp","Administrator","Action","Target","Reason"]} rows={(data.logs || []).map((log: AnyRecord) => [
            date(log.created_at), shortId(log.actor_user_id), <span className="ops-audit-action" key="action">{log.action}</span>,
            (log.resource_type || "") + " · " + (log.resource_id ? shortId(log.resource_id) : "—"), log.reason,
          ])} empty="No administrative actions recorded yet."/>
        </section>}
        {section === "team" && <section className="ops-panel">
          <div className="ops-panel-head"><div><h2>Team access</h2><p>Supabase Auth UUIDs map to roles stored in Neon. MFA is required for every admin session.</p></div><span className="ops-count">Owner-controlled</span></div>
          {can(["OWNER"]) ? <div className="ops-team-add"><input value={teamUserId} onChange={e=>setTeamUserId(e.target.value)} placeholder="Supabase Auth user UUID"/>
            <select value={teamRole} onChange={e=>setTeamRole(e.target.value as Role)}>{(["ADMIN","SUPPORT","ANALYST","AUDITOR","OWNER"] as Role[]).map(v=><option key={v}>{v}</option>)}</select>
            <button className="ops-button primary" onClick={() => { setModal({type:"team-upsert",title:"Add or update team member",userId:teamUserId,role:teamRole,status:"ACTIVE",operationId:crypto.randomUUID()}); setReason(""); }} disabled={!teamUserId}>Save member</button></div> : <div className="ops-alert neutral"><Lock size={16}/> Only the Owner can manage team access.</div>}
          <DataTable headers={["Member UUID","Role","Status","Actions recorded","Updated","Access"]} rows={(data.members || []).map((m: AnyRecord) => [
            shortId(m.user_id), m.role, <span className={statusClass(m.status)}>{m.status}</span>, number(m.actions_count), date(m.updated_at),
            can(["OWNER"]) && m.user_id !== data.currentUserId ? <button className="ops-button subtle" key="revoke" onClick={() => { setModal({type:"team-upsert",title:"Revoke team access",userId:m.user_id,role:m.role,status:"REVOKED",operationId:crypto.randomUUID()}); setReason(""); }}>Revoke</button> : "—",
          ])} empty="No team members are registered yet. The first Owner is created through the UUID allowlist bootstrap."/>
        </section>}
      </div>
    </main>

    {selectedUser && <div className="ops-drawer-backdrop" onClick={() => setSelectedUser(null)}>
      <aside className="ops-drawer" onClick={e => e.stopPropagation()}>
        <DrawerHeader title="Account details" onClose={() => setSelectedUser(null)}/>
        <div className="ops-drawer-content">
          {selectedUser.user && <><div className="ops-profile"><div className="ops-avatar">{String(selectedUser.user.name || "U").slice(0,1).toUpperCase()}</div><div><strong>{selectedUser.user.name || "Unnamed account"}</strong><small>{selectedUser.user.email || shortId(selectedUser.user.id)}</small><span className={statusClass(selectedUser.user.account_status)}>{selectedUser.user.account_status}</span></div></div>
            <div className="ops-detail-grid"><Detail label="Account ID" value={selectedUser.user.id}/><Detail label="Account type" value={selectedUser.user.account_type}/><Detail label="Total XP" value={number(selectedUser.user.total_xp)}/><Detail label="Level" value={number(selectedUser.user.current_level)}/><Detail label="Total points" value={number(selectedUser.user.total_points)}/><Detail label="Created" value={date(selectedUser.user.created_at)}/><Detail label="Email verified" value={date(selectedUser.user.email_verified_at)}/><Detail label="Active sessions" value={number(selectedUser.activeSessions)}/><Detail label="Trips recorded" value={number(selectedUser.tripCount)}/></div>
            {selectedUser.user.suspension_reason && <div className="ops-reason-box"><small>Suspension reason</small>{selectedUser.user.suspension_reason}</div>}
            <h3>Recent journeys</h3><div className="ops-mini-list">{(selectedUser.recentTrips || []).map((t: AnyRecord)=><div key={t.id}><strong>{shortId(t.id)}</strong><span>{t.status}</span><small>{date(t.started_at)}</small></div>)}</div>
            <h3>Recent XP ledger</h3><div className="ops-mini-list">{(selectedUser.recentXp || []).map((x: AnyRecord,i:number)=><div key={x.id || i}><strong>{x.delta_xp ?? x.points} XP</strong><span>{x.reason_code || x.reason || "Award"}</span><small>{date(x.created_at)}</small></div>)}</div>
            {(can(["OWNER","ADMIN","SUPPORT"])) && <div className="ops-drawer-actions">
              {can(["OWNER","ADMIN"]) && (selectedUser.user.account_status === "SUSPENDED"
                ? <button className="ops-button primary" onClick={() => { setModal({type:"restore-user",title:"Restore account",userId:selectedUser.user.id,operationId:crypto.randomUUID()}); setReason(""); }}>Restore account</button>
                : <button className="ops-button danger" onClick={() => { setModal({type:"suspend-user",title:"Suspend account",userId:selectedUser.user.id,operationId:crypto.randomUUID()}); setReason(""); }}>Suspend account</button>)}
              <button className="ops-button subtle" onClick={() => { setModal({type:"revoke-sessions",title:"Revoke all sessions",userId:selectedUser.user.id,operationId:crypto.randomUUID()}); setReason(""); }}>Revoke sessions</button>
            </div>}
          </>}
        </div>
      </aside>
    </div>}

    {selectedTrip && <div className="ops-drawer-backdrop" onClick={() => setSelectedTrip(null)}>
      <aside className="ops-drawer" onClick={e => e.stopPropagation()}>
        <DrawerHeader title="Trip diagnostic report" onClose={() => setSelectedTrip(null)}/>
        <div className="ops-drawer-content">
          {selectedTrip.trip && <><div className="ops-profile"><div className="ops-avatar"><Route size={21}/></div><div><strong>{shortId(selectedTrip.trip.id)}</strong><small>{selectedTrip.trip.user_name || shortId(selectedTrip.trip.user_id)}</small><span className={statusClass(selectedTrip.trip.status)}>{selectedTrip.trip.status}</span></div></div>
            <div className="ops-detail-grid"><Detail label="Started" value={date(selectedTrip.trip.started_at)}/><Detail label="Ended" value={date(selectedTrip.trip.ended_at)}/><Detail label="Distance" value={(Number(selectedTrip.trip.distance_m || 0)/1000).toFixed(2)+" km"}/><Detail label="Duration" value={Math.round(Number(selectedTrip.trip.duration_ms || 0)/60000)+" min"}/><Detail label="Safety score" value={selectedTrip.trip.safety_score == null ? "—" : selectedTrip.trip.safety_score+"/100"}/><Detail label="Telemetry quality" value={selectedTrip.trip.telemetry_quality == null ? "—" : Math.round(selectedTrip.trip.telemetry_quality*100)+"%"}/><Detail label="Classification" value={selectedTrip.trip.trip_classification}/><Detail label="Ruleset" value={selectedTrip.trip.engine_version}/><Detail label="Eligibility reason" value={selectedTrip.trip.eligibility_reason || "—"}/></div>
            <h3>Sensor quality</h3><div className="ops-detail-grid">{Object.entries(selectedTrip.metrics || {}).filter(([k])=>k!=="trip_id").map(([k,v])=><Detail key={k} label={k.replaceAll("_"," ")} value={String(v ?? "—")}/>)}</div>
            <h3>Event evidence</h3><div className="ops-mini-list">{(selectedTrip.eventGroups || []).map((e:AnyRecord,i:number)=><div key={i}><strong>{e.event_type}</strong><span>{e.severity}</span><small>{number(e.count)} events</small></div>)}</div>
            <h3>XP decision</h3><div className="ops-mini-list">{(selectedTrip.xpLedger || []).map((x:AnyRecord,i:number)=><div key={i}><strong>{x.delta_xp ?? x.points} XP</strong><span>{x.ruleset_version}</span><small>{x.reason || x.reason_code}</small></div>)}</div>
            <h3>Synchronization history</h3><div className="ops-mini-list">{(selectedTrip.syncHistory || []).map((x:AnyRecord,i:number)=><div key={i}><strong>{x.sync_status}</strong><span>{number(x.attempt_count)} attempts</span><small>{x.last_error || date(x.synced_at)}</small></div>)}</div>
          </>}
        </div>
      </aside>
    </div>}

    {modal && <div className="ops-modal-backdrop" onClick={() => !busy && setModal(null)}>
      <section className="ops-modal" onClick={e=>e.stopPropagation()}>
        <div className="ops-modal-top"><div><div className="ops-eyebrow">CONFIRM ADMINISTRATIVE ACTION</div><h2>{modal.title}</h2></div><button className="ops-icon-button" onClick={() => setModal(null)}><X size={17}/></button></div>
        {modal.type === "adjust-xp" && <label className="ops-field">Account UUID<input value={modal.userId || ""} onChange={e=>setModal({...modal,userId:e.target.value})} placeholder="Target account UUID"/></label>}
        {modal.type === "adjust-xp" && <label className="ops-field">XP change<input type="number" min={-500} max={500} value={delta} onChange={e=>setDelta(e.target.value)}/><small>Positive adds XP; negative removes XP. Balance cannot become negative.</small></label>}
        {modal.type === "update-config" && <><div className="ops-config-preview"><strong>{modal.key}</strong><small>Versioned remote configuration. Existing clients only consume supported keys.</small></div>
          {modal.key === "pilot_mode" ? <select value={String(modal.value)} onChange={e=>setModal({...modal,value:e.target.value==="true"})}><option value="false">Disabled</option><option value="true">Enabled</option></select>
          : modal.key === "feature_flags" ? <textarea rows={8} value={configJson} onChange={e=>setConfigJson(e.target.value)}/>
          : <input value={String(modal.value ?? "")} maxLength={180} onChange={e=>setModal({...modal,value:e.target.value})}/>}
        </>}
        {modal.type === "team-upsert" && <div className="ops-config-preview"><strong>{modal.userId}</strong><span>{modal.role} · {modal.status}</span></div>}
        <label className="ops-field">Reason (required)<textarea rows={3} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain why this action is necessary (8–500 characters)."/></label>
        <div className="ops-modal-actions"><button className="ops-button subtle" onClick={()=>setModal(null)} disabled={busy}>Cancel</button>
          <button className={"ops-button "+(["suspend-user","revoke-sessions","team-upsert"].includes(modal.type) && modal.status !== "ACTIVE" ? "danger" : "primary")} disabled={busy || reason.trim().length < 8} onClick={()=>{
            if (modal.type === "suspend-user") void submitAction("suspend-user",{userId:modal.userId,operationId:modal.operationId});
            else if (modal.type === "restore-user") void submitAction("restore-user",{userId:modal.userId,operationId:modal.operationId});
            else if (modal.type === "revoke-sessions") void submitAction("revoke-sessions",{userId:modal.userId,operationId:modal.operationId});
            else if (modal.type === "adjust-xp") void submitAction("adjust-xp",{userId:modal.userId,delta:Number(delta),operationId:modal.operationId});
            else if (modal.type === "team-upsert") void submitAction("upsert-team-member",{userId:modal.userId,role:modal.role,status:modal.status,operationId:modal.operationId});
            else if (modal.type === "update-config") {
              let value=modal.value;
              try { if(modal.key==="feature_flags") value=JSON.parse(configJson); } catch { setError("Feature flags must be valid JSON."); return; }
              void submitAction("update-config",{key:modal.key,value,operationId:modal.operationId});
            }
          }}>{busy ? "Processing…" : "Confirm and record"}</button>
        </div>
        <p className="ops-modal-foot"><Lock size={12}/> This operation is permission-checked server-side and recorded in the administrative audit log.</p>
      </section>
    </div>}
  </div>;
}

function sectionDescription(section: Section) {
  const copy: Record<Section,string> = {
    overview:"A live operational picture of CrediSafe.",
    users:"Investigate Android accounts, status, sessions and account health.",
    trips:"Diagnose trip processing, sensor evidence and synchronization outcomes.",
    xp:"Inspect append-only XP transactions and controlled corrections.",
    releases:"Review published Android builds and their signed distribution assets.",
    config:"Manage versioned remote settings supported by the Android client.",
    health:"Check backend and database reachability without inventing uptime.",
    audit:"Review the immutable history of administrative actions.",
    team:"Grant and revoke narrowly scoped operational access.",
  };
  return copy[section];
}

function SearchBar({value,onChange,onSubmit,placeholder}:{value:string;onChange:(v:string)=>void;onSubmit:()=>void;placeholder:string}) {
  return <form className="ops-search" onSubmit={e=>{e.preventDefault();onSubmit();}}><Search size={16}/><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/><button className="ops-button subtle">Search</button></form>;
}

function DataTable({headers,rows,empty}:{headers:string[];rows:ReactNode[][];empty:string}) {
  return <div className="ops-table-wrap">{rows.length ? <table className="ops-table"><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table> : <Empty title="Nothing to display" detail={empty}/>}</div>;
}

function DrawerHeader({title,onClose}:{title:string;onClose:()=>void}) {
  return <div className="ops-drawer-head"><div><span className="ops-eyebrow">OPERATIONS RECORD</span><h2>{title}</h2></div><button className="ops-icon-button" onClick={onClose}><X size={18}/></button></div>;
}
function Detail({label,value}:{label:string;value:React.ReactNode}) {
  return <div className="ops-detail"><small>{label}</small><span>{value}</span></div>;
}
function ShieldCheckIcon() { return <BadgeCheck size={15}/>; }

function OverviewPanel({data,setSection}:{data:AnyRecord;setSection:(s:Section)=>void}) {
  const t=data.totals || {};
  return <>
    <div className="ops-metrics-grid">
      <Metric label="Total accounts" value={t.users} detail={number(t.activeUsers)+" active · "+number(t.suspendedUsers)+" suspended"} icon={Users}/>
      <Metric label="Recorded journeys" value={t.trips} detail="Android / Neon" icon={Route} tone="blue"/>
      <Metric label="Driving events" value={t.events} detail="Stored safety evidence" icon={Activity} tone="purple"/>
      <Metric label="Telemetry uploads" value={t.telemetryUploads} detail="Evidence assets" icon={Database} tone="blue"/>
      <Metric label="Sync issues" value={t.syncIssues} detail="Audit records to review" icon={AlertTriangle} tone={t.syncIssues ? "amber" : "mint"}/>
    </div>
    <div className="ops-overview-grid">
      <section className="ops-panel"><div className="ops-panel-head"><div><h2>Journey status</h2><p>Current trip outcomes recorded by the backend.</p></div><Route size={18}/></div>
        {(data.tripsByStatus || []).length ? data.tripsByStatus.map((row:AnyRecord)=><div className="ops-breakdown" key={row.status}><span>{row.status}</span><strong>{number(row.count)}</strong></div>) : <Empty title="No journeys yet" detail="Trip status data will appear when Android journeys sync."/>}
        <button className="ops-text-link" onClick={()=>setSection("trips")}>Open trip diagnostics <ChevronRight size={14}/></button>
      </section>
      <section className="ops-panel"><div className="ops-panel-head"><div><h2>Safety events</h2><p>Uploaded driving event categories.</p></div><BarChart3 size={18}/></div>
        {(data.eventsByType || []).length ? data.eventsByType.map((row:AnyRecord)=><div className="ops-breakdown" key={row.type}><span>{String(row.type).replaceAll("_"," ").toLowerCase()}</span><strong>{number(row.count)}</strong></div>) : <Empty title="No event data" detail="No events have been uploaded yet."/>}
      </section>
    </div>
    <section className="ops-panel"><div className="ops-panel-head"><div><h2>Recent account activity</h2><p>Latest account registrations. This is not a measure of daily active users.</p></div><Users size={18}/></div>
      <DataTable headers={["Account","Type","Status","Total XP","Level","Registered"]} rows={(data.recentUsers || []).map((u:AnyRecord)=>[
        <span key="name"><strong>{u.name || "Unnamed account"}</strong><small>{shortId(u.id)}</small></span>,
        u.accountType,<span className={statusClass(u.accountStatus)}>{u.accountStatus}</span>,
        number(u.totalXp),number(u.level),date(u.createdAt),
      ])} empty="No recent registrations."/>
      <button className="ops-text-link" onClick={()=>setSection("users")}>Open people & accounts <ChevronRight size={14}/></button>
    </section>
    <div className="ops-source-note"><span><CheckCircle2 size={14}/> Real backend data</span><span>Source: {data.source || "—"} · Updated {date(data.fetchedAt)}</span><span>Web / Supabase identities are not yet unified with Android / Neon.</span></div>
  </>;
}

function ConfigPanel({data,role,onSave}:{data:AnyRecord;role:Role;onSave:(key:string,value:unknown)=>void}) {
  const values:AnyRecord={};
  for(const row of data.configuration||[]) values[row.config_key]=row.config_value;
  const keys=[
    {key:"pilot_mode",label:"Pilot mode",description:"Allow pilot-only app behavior where supported.",value:values.pilot_mode ?? false},
    {key:"maintenance_banner",label:"Maintenance banner",description:"Message displayed by clients that read this configuration.",value:values.maintenance_banner ?? ""},
    {key:"minimum_android_version",label:"Minimum Android version",description:"Semver floor for clients configured to enforce update requirements.",value:values.minimum_android_version ?? "2.7.0-beta.4.2"},
    {key:"xp_ruleset_version",label:"XP ruleset version",description:"Only explicitly supported ruleset versions may be selected.",value:values.xp_ruleset_version ?? "XP_RULESET_V1"},
    {key:"feature_flags",label:"Feature flags",description:"JSON object mapping supported feature identifiers to booleans.",value:values.feature_flags ?? {}},
  ];
  return <div className="ops-config-list">{keys.map(item=><article className="ops-config-item" key={item.key}><div><strong>{item.label}</strong><small>{item.description}</small><span className="ops-config-key">{item.key} · v{(data.configuration||[]).find((r:AnyRecord)=>r.config_key===item.key)?.version || 0}</span></div>
      {role==="OWNER"||role==="ADMIN" ? <button className="ops-button subtle" onClick={()=>onSave(item.key,item.value)}>Edit setting</button> : <span className="ops-read-only">Read only</span>}
    </article>)}
    <div className="ops-warning-note"><ShieldAlert size={17}/><span>Remote configuration only affects client features explicitly designed to consume these keys. XP rules, reward caps and safety validation remain server-authoritative.</span></div>
  </div>;
}

function HealthPanel({data}:{data:AnyRecord}) {
  const services=data.services || {};
  const items=[
    {key:"render",label:"Render Android API",description:"Production API process and endpoint reachability.",icon:Cloud},
    {key:"neon",label:"Neon PostgreSQL",description:"Database query health from the Render service.",icon:Database},
    {key:"supabase",label:"Supabase Auth",description:"Website authentication provider reachability.",icon:Shield},
    {key:"vercel",label:"Vercel website runtime",description:"This authenticated request is currently served by the production web deployment.",icon:Activity},
  ];
  return <section className="ops-panel"><div className="ops-panel-head"><div><h2>Service health checks</h2><p>Point-in-time checks, not historical uptime or an SLA.</p></div><Gauge size={19}/></div>
    <div className="ops-health-grid">{items.map(item=>{const Icon=item.icon;const status=services[item.key]?.status || "unknown";return <article className="ops-health-card" key={item.key}><div className="ops-health-icon"><Icon size={21}/></div><div><strong>{item.label}</strong><small>{item.description}</small></div><span className={statusClass(status)}>{status}</span></article>;})}</div>
    <div className="ops-source-note"><span>Checked {date(data.checkedAt)}</span><span>Vercel and Supabase checks are tracked separately; no unverified status is displayed.</span></div>
  </section>;
}
