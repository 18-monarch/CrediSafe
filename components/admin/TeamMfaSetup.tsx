"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Enrollment = { id: string; qr: string };
type Passkey = { id: string; friendly_name?: string | null; created_at?: string; last_used_at?: string | null };

const passkeyEnabled = process.env.NEXT_PUBLIC_SUPABASE_PASSKEY_ENABLED === "true";

export function TeamMfaSetup() {
  const [factorId, setFactorId] = useState("");
  const [enroll, setEnroll] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("Checking your security settings…");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);

  async function refreshPasskeys() {
    const api = createClient();
    if (!api || !passkeyEnabled) return;
    const result = await api.auth.passkey.list();
    if (result.error) throw new Error(result.error.message);
    setPasskeys(result.data ?? []);
  }

  useEffect(() => {
    const api = createClient();
    if (!api) { setMessage("Supabase is not configured."); return; }
    let cancelled = false;
    void (async () => {
      try {
        const current = await api.auth.mfa.getAuthenticatorAssuranceLevel();
        if (current.data?.currentLevel === "aal2") {
          if (cancelled) return;
          setVerified(true);
          setMessage("Authenticator MFA is verified for this session.");
          if (passkeyEnabled) {
            const listed = await api.auth.passkey.list();
            if (!cancelled && !listed.error) setPasskeys(listed.data ?? []);
            if (!cancelled && listed.error) setMessage("Authenticator MFA is active. Passkey status could not be loaded; refresh this page to retry.");
          }
          return;
        }
        const factors = await api.auth.mfa.listFactors();
        const existing = factors.data?.totp?.find((factor: { status: string; id: string }) => factor.status === "verified");
        if (cancelled) return;
        if (existing) {
          setFactorId(existing.id);
          setMessage("Enter a current code from your authenticator app to reach the required AAL2 security level.");
        } else {
          setMessage("Set up time-based authenticator MFA to unlock the team dashboard.");
        }
      } catch {
        if (!cancelled) setMessage("Could not read security settings. Sign in again and retry.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function start() {
    const api = createClient();
    if (!api) return;
    setBusy(true);
    try {
      const result = await api.auth.mfa.enroll({ factorType: "totp", friendlyName: "CrediSafe Platform Owner" });
      if (result.error || !result.data?.totp) throw new Error(result.error?.message || "Enrollment failed");
      setFactorId(result.data.id);
      setEnroll({ id: result.data.id, qr: result.data.totp.qr_code });
      setMessage("Scan the QR code using your authenticator app, then enter the 6-digit code.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not configure MFA");
    } finally { setBusy(false); }
  }

  async function confirm() {
    const api = createClient();
    if (!api || !factorId || !/^\d{6}$/.test(code)) { setMessage("Enter a valid 6-digit authenticator code."); return; }
    setBusy(true);
    try {
      const challenge = await api.auth.mfa.challenge({ factorId });
      if (challenge.error || !challenge.data?.id) throw new Error(challenge.error?.message || "Challenge failed");
      const result = await api.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
      if (result.error) throw new Error(result.error.message);
      setVerified(true); setCode(""); setEnroll(null);
      setMessage("Authenticator MFA verified. Your session now meets the AAL2 requirement.");
      if (passkeyEnabled) {
        try { await refreshPasskeys(); }
        catch { setMessage("Authenticator MFA is active. Passkey status could not be loaded; refresh this page to retry."); }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Code verification failed");
    } finally { setBusy(false); }
  }

  async function registerPasskey() {
    const api = createClient();
    if (!api || !verified || !passkeyEnabled) return;
    setBusy(true);
    try {
      const result = await api.auth.registerPasskey();
      if (result.error) throw new Error(result.error.message);
      await refreshPasskeys();
      setMessage("Passkey registered. Use it for sign-in; authenticator TOTP remains the stable AAL2 factor required by the admin system.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not register a passkey. Confirm passkeys are enabled in Supabase and try again.");
    } finally { setBusy(false); }
  }

  async function removePasskey(passkeyId: string) {
    const api = createClient();
    if (!api || !verified || !passkeyEnabled) return;
    if (!window.confirm("Remove this passkey from the CrediSafe Owner account?")) return;
    setBusy(true);
    try {
      const result = await api.auth.passkey.delete({ passkeyId });
      if (result.error) throw new Error(result.error.message);
      await refreshPasskeys();
      setMessage("Passkey removed from this account.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove the passkey.");
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-[#09121a] px-5 py-20 text-white">
      <section className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-white/[.04] p-8">
        <div className="mb-4 text-xs font-bold uppercase tracking-widest text-emerald-300">CrediSafe Team Security</div>
        <h1 className="text-3xl font-bold tracking-tight">Protect the Control Center</h1>
        <p className="my-5 text-sm leading-7 text-slate-300">The Platform Owner uses an authenticator code for the required AAL2 second factor and can register a passkey for phishing-resistant sign-in. Authentication secrets stay with Supabase and your authenticator.</p>
        <p className="mb-5 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200" role="status" aria-live="polite">{message}</p>
        {!verified && !factorId && <button type="button" disabled={busy} onClick={start} className="w-full rounded-xl bg-emerald-400 p-3 font-bold text-[#082119] disabled:opacity-60">{busy ? "Please wait…" : "Set up authenticator MFA"}</button>}
        {enroll && <div className="my-5 rounded-2xl bg-white p-5 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="Temporary authenticator enrollment QR code" src={enroll.qr} className="mx-auto w-52" />
        </div>}
        {!verified && factorId && <div className="space-y-4">
          <label className="block text-sm text-slate-200">6-digit authenticator code
            <input className="mt-2 w-full rounded-xl border border-white/20 bg-[#142c32] p-3 text-white" value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={busy} />
          </label>
          <button type="button" onClick={confirm} disabled={busy} className="w-full rounded-xl bg-emerald-400 p-3 font-bold text-[#082119] disabled:opacity-60">{busy ? "Verifying…" : "Verify authenticator"}</button>
        </div>}
        {verified && <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[.06] p-4">
            <div className="text-sm font-semibold text-emerald-200">Authenticator MFA · Verified (AAL2)</div>
            <p className="mt-1 text-xs leading-5 text-slate-300">This is the stable second factor enforced by the CrediSafe admin API. Keep a separate backup authenticator factor on a different trusted device.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-semibold">Passkey sign-in</div>
            <p className="mt-1 text-xs leading-5 text-slate-300">Add a passkey using Windows Hello, a device biometric/PIN, a security key, or a supported password manager. Passkey support is currently an experimental Supabase feature.</p>
            {passkeyEnabled ? <>
              <button type="button" onClick={registerPasskey} disabled={busy} className="mt-4 w-full rounded-xl border border-emerald-300/40 bg-emerald-300/10 p-3 text-sm font-bold text-emerald-100 disabled:opacity-60">{busy ? "Please wait…" : passkeys.length ? "Register another passkey" : "Register a passkey"}</button>
              {passkeys.length > 0 ? <ul className="mt-4 space-y-2">{passkeys.map((passkey) => <li key={passkey.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3">
                <div className="min-w-0"><div className="truncate text-sm font-medium">{passkey.friendly_name || "Registered passkey"}</div>
                  <div className="text-xs text-slate-400">{passkey.created_at ? "Added " + new Date(passkey.created_at).toLocaleDateString() : "Registered"}</div>
                </div>
                <button type="button" onClick={() => removePasskey(passkey.id)} disabled={busy} className="shrink-0 rounded-lg border border-rose-300/30 px-3 py-2 text-xs font-semibold text-rose-200 disabled:opacity-60">Remove</button>
              </li>)}</ul> : <p className="mt-3 text-xs text-amber-100/90">No passkeys are registered on this account yet.</p>}
            </> : <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[.06] p-3 text-xs leading-5 text-amber-100/90">Passkeys are not enabled for this deployment yet. Enable Passkey authentication in the Supabase project first, then set NEXT_PUBLIC_SUPABASE_PASSKEY_ENABLED=true in Vercel Production and redeploy.</p>}
          </div>
          <Link className="inline-flex rounded-xl bg-emerald-400 px-5 py-3 font-bold text-[#082119]" href="/admin">Open Control Center</Link>
        </div>}
        <div className="mt-8 text-xs text-slate-400">Restricted to approved Supabase accounts. Never share an authenticator QR code, TOTP secret, passkey prompt, password, or recovery material.</div>
      </section>
    </main>
  );
}
