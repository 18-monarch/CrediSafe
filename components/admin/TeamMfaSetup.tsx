"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Enrollment = { id: string; qr: string };
export function TeamMfaSetup() {
  const [factorId, setFactorId] = useState("");
  const [enroll, setEnroll] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("Checking your security settings…");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const api = createClient();
    if (!api) { setMessage("Supabase is not configured."); return; }
    void (async () => {
      const current = await api.auth.mfa.getAuthenticatorAssuranceLevel();
      if (current.data?.currentLevel === "aal2") {
        setVerified(true);
        setMessage("Multi-factor authentication is already active.");
        return;
      }
      const factors = await api.auth.mfa.listFactors();
      const existing = factors.data?.totp?.find((f: { status: string; id: string }) => f.status === "verified");
      if (existing) {
        setFactorId(existing.id);
        setMessage("Enter a current code from your authenticator app.");
      } else {
        setMessage("Set up time-based authenticator MFA to unlock the team dashboard.");
      }
    })();
  }, []);

  async function start() {
    const api = createClient();
    if (!api) return;
    setBusy(true);
    try {
      const r = await api.auth.mfa.enroll({ factorType: "totp", friendlyName: "CrediSafe Team" });
      if (r.error || !r.data?.totp) throw new Error(r.error?.message || "Enrollment failed");
      setFactorId(r.data.id);
      setEnroll({ id: r.data.id, qr: r.data.totp.qr_code });
      setMessage("Scan the QR code using an authenticator app, then enter the 6-digit code.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not configure MFA"); }
    finally { setBusy(false); }
  }

  async function confirm() {
    const api = createClient();
    if (!api || !factorId || !/^\d{6}$/.test(code)) {
      setMessage("Enter a valid 6-digit authenticator code."); return;
    }
    setBusy(true);
    try {
      const challenge = await api.auth.mfa.challenge({ factorId });
      if (challenge.error || !challenge.data?.id) throw new Error(challenge.error?.message || "Challenge failed");
      const result = await api.auth.mfa.verify({
        factorId, challengeId: challenge.data.id, code,
      });
      if (result.error) throw new Error(result.error.message);
      setVerified(true); setCode(""); setEnroll(null);
      setMessage("MFA verified for this session.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Code verification failed"); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#09121a] px-5 py-20 text-white">
    <section className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-white/[.04] p-8">
      <div className="mb-4 text-xs font-bold uppercase tracking-widest text-emerald-300">CrediSafe Team Security</div>
      <h1 className="text-3xl font-bold tracking-tight">Protect the Control Center</h1>
      <p className="my-5 text-sm leading-7 text-slate-300">Team analytics requires explicit approval and a second authentication factor. Authentication codes are never stored in CrediSafe.</p>
      <p className="mb-5 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200" role="status">{message}</p>
      {!verified && !factorId && <button disabled={busy} onClick={start} className="w-full rounded-xl bg-emerald-400 p-3 font-bold text-[#082119]">Set up authenticator MFA</button>}
      {enroll && <div className="my-5 rounded-2xl bg-white p-5 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="Scan this temporary team MFA enrollment QR code" src={enroll.qr} className="mx-auto w-52"/>
      </div>}
      {!verified && factorId && <div className="space-y-4">
        <label className="block text-sm text-slate-200">6-digit authenticator code
          <input className="mt-2 w-full rounded-xl border border-white/20 bg-[#142c32] p-3 text-white" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code"/>
        </label>
        <button onClick={confirm} disabled={busy} className="w-full rounded-xl bg-emerald-400 p-3 font-bold text-[#082119]">Verify authenticator</button>
      </div>}
      {verified && <Link className="inline-flex rounded-xl bg-emerald-400 px-5 py-3 font-bold text-[#082119]" href="/admin">Open Control Center</Link>}
      <div className="mt-8 text-xs text-slate-400">This page is restricted to pre-approved Supabase account IDs. Do not share authenticator enrollment QR codes.</div>
    </section>
  </main>;
}
