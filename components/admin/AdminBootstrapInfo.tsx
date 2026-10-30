"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";

export function AdminBootstrapInfo({
  userId,
  allowlisted,
  message,
  bridgeStatus,
  bridgeDetail,
}: {
  userId: string;
  allowlisted: boolean;
  message: string;
  bridgeStatus: "ok" | "not_configured" | "rejected" | "unavailable";
  bridgeDetail: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return <main className="min-h-screen bg-[#09121a] px-5 py-16 text-white">
    <section className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[.04] p-7 sm:p-9">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">
        <ShieldAlert size={23}/>
      </div>
      <div className="text-xs font-bold uppercase tracking-[.18em] text-emerald-300">CrediSafe · Operations Center</div>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Admin access setup</h1>
      <p className="mt-3 text-sm leading-7 text-slate-300">
        Your website account is signed in, but it is not yet enabled as a CrediSafe administrator.
        The following is your Supabase Auth user UUID. It is an identifier, not a password or access token.
      </p>
      <div className="mt-7 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-2 text-xs font-semibold text-slate-400">YOUR SUPABASE AUTH USER UUID</div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <code className="min-w-0 flex-1 break-all rounded-xl bg-slate-900 p-3 text-sm text-emerald-200">{userId}</code>
          <button onClick={copy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-[#062319]">
            {copied ? <Check size={16}/> : <Copy size={16}/>}
            {copied ? "Copied" : "Copy UUID"}
          </button>
        </div>
      </div>
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <strong className="text-sm">Vercel ↔ Render bridge</strong>
          <span className={bridgeStatus === "ok" ? "rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-200" : "rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold text-amber-100"}>
            {bridgeStatus === "ok" ? "Connected" : bridgeStatus === "rejected" ? "Check secret" : bridgeStatus === "not_configured" ? "Not configured" : "Unavailable"}
          </span>
        </div>
        <p className="text-sm leading-6 text-slate-300">{bridgeDetail}</p>
      </div>
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {allowlisted ? <ShieldCheck className="text-emerald-300" size={18}/> : <ShieldAlert className="text-amber-300" size={18}/>}
          {allowlisted ? "Owner bootstrap is enabled for this UUID" : "One-time Owner approval is required"}
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-300">{message}</p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300">
          <li>Open the Vercel project settings for <strong>credi-safe</strong>.</li>
          <li>In Environment Variables, add <code className="rounded bg-black/30 px-1.5 py-0.5 text-emerald-200">CREDISAFE_ADMIN_USER_IDS</code> with this exact UUID as its value.</li>
          <li>Apply it to the <strong>Production</strong> environment (and Preview only if you intend to use admin previews).</li>
          <li>Redeploy the production website so the server can read the allowlist.</li>
          <li>Return here. The first approved request creates the initial Owner membership. Then enroll and verify an authenticator in this page.</li>
        </ol>
        <a className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 underline" href="https://vercel.com/mohitchaudhari018-4820s-projects/credi-safe/settings/environment-variables" target="_blank" rel="noreferrer">
          Open CrediSafe Vercel environment settings <ExternalLink size={14}/>
        </a>
      </div>
      <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[.06] p-4 text-xs leading-6 text-amber-100/90">
        Security: adding the UUID only grants initial Owner bootstrap eligibility. Admin APIs still require a valid Supabase session, MFA AAL2, a signed server-to-server assertion and an active backend role. Never put the bridge secret or any service-role key in a browser variable.
      </div>
      <a className="mt-6 inline-block text-sm text-slate-400 underline" href="/">Return to CrediSafe</a>
    </section>
  </main>;
}
