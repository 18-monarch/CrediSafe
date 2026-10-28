"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfigIssue, isSupabaseConfigured } from "@/lib/supabase/config";
import { getFriendlyAuthError } from "@/lib/supabase/authMessages";
import { getAuthSiteOrigin } from "@/lib/supabase/siteUrl";

function recoveryCallbackUrl() {
  const origin = getAuthSiteOrigin(typeof window === "undefined" ? undefined : window.location.origin);
  if (!origin) throw new Error("Secure password-recovery links cannot be created because the canonical website URL is not configured.");
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", "/reset-password");
  return url.toString();
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const configured = isSupabaseConfigured();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!configured) {
      setMessage(getSupabaseConfigIssue() ?? "Password recovery is temporarily unavailable.");
      return;
    }
    const client = createClient();
    if (!client) {
      setMessage("Password recovery is temporarily unavailable.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: recoveryCallbackUrl(),
      });
      if (error) throw error;
      // Supabase intentionally avoids confirming whether an account exists.
      setSent(true);
      setMessage("If an account exists for that address, a password-reset email has been sent. Check spam/junk and use the newest email.");
    } catch (error) {
      setMessage(getFriendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <Link href="/" className="auth-brand" aria-label="CrediSafe home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/credisafe-logo.png" alt="CrediSafe" />
      </Link>
      <div className="auth-card">
        <span className="auth-eyebrow">Account recovery</span>
        <h1>Reset your password.</h1>
        <p>We’ll send a secure, single-use link if an account is associated with your email address.</p>
        <form onSubmit={submit}>
          <label htmlFor="recovery-email">
            <span>Email address</span>
            <div><Mail size={18}/><input id="recovery-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" autoCapitalize="none" spellCheck={false} required disabled={busy || !configured} placeholder="you@example.com"/></div>
          </label>
          {message && <div className="auth-message" role="status" aria-live="polite">{message}</div>}
          <button type="submit" disabled={busy || sent || !configured}>
            {busy ? "Sending…" : sent ? "Email requested" : "Send reset link"} <ArrowRight size={18}/>
          </button>
        </form>
        {!configured && <div className="auth-message" role="alert">{getSupabaseConfigIssue()}</div>}
        <div className="auth-switch"><Link href="/login">Back to sign in</Link></div>
        <small>If the email never arrives, ask the team to verify Supabase email delivery, sender limits and the allowed redirect URL.</small>
      </div>
    </div>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [recoveryError, setRecoveryError] = useState(false);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    const client = createClient();
    if (!client) {
      setMessage(getSupabaseConfigIssue() ?? "Password recovery is unavailable.");
      setRecoveryError(true);
      setChecking(false);
      return;
    }

    let active = true;
    const { data: listener } = client.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" && session) {
        setReady(true);
        setRecoveryError(false);
        setMessage("");
      } else if (session) {
        setReady(true);
        setRecoveryError(false);
      }
    });
    void client.auth.getSession().then((result: { data: { session: Session | null }; error: unknown }) => {
      const { data, error } = result;
      if (!active) return;
      setReady(Boolean(data.session));
      if (error) {
        setMessage(getFriendlyAuthError(error));
        setRecoveryError(true);
      } else if (!data.session) {
        setMessage("This page needs a valid password-reset session. Open the newest reset email link, or request another one.");
        setRecoveryError(true);
      }
      setChecking(false);
    }).catch((error: unknown) => {
      if (!active) return;
      setMessage(getFriendlyAuthError(error));
      setRecoveryError(true);
      setChecking(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!configured) {
      setMessage(getSupabaseConfigIssue() ?? "Password recovery is unavailable.");
      return;
    }
    if (password.length < 8) {
      setMessage("Choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("The passwords don't match. Re-enter them and try again.");
      return;
    }
    const client = createClient();
    if (!client || !ready) {
      setMessage("Your reset session is missing or expired. Request a new reset email.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      // Close the recovery session before returning the user to the sign-in screen.
      await client.auth.signOut();
      router.replace("/login?success=password_updated");
      router.refresh();
    } catch (error) {
      setMessage(getFriendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <Link href="/" className="auth-brand" aria-label="CrediSafe home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/credisafe-logo.png" alt="CrediSafe" />
      </Link>
      <div className="auth-card">
        <span className="auth-eyebrow">Account recovery</span>
        <h1>Choose a new password.</h1>
        <p>For security, use a password you don't use on another website.</p>
        {checking ? <div className="auth-message" role="status">Checking your recovery link…</div> : recoveryError && !ready ? (
          <div className="auth-message" role="alert">{message || "Your reset link is invalid or expired."}</div>
        ) : (
          <form onSubmit={submit}>
            <label htmlFor="new-password"><span>New password</span><div><LockKeyhole size={18}/><input id="new-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required disabled={busy || !ready}/></div></label>
            <label htmlFor="confirm-new-password"><span>Confirm new password</span><div><LockKeyhole size={18}/><input id="confirm-new-password" type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required disabled={busy || !ready}/></div></label>
            {message && <div className="auth-message" role="status">{message}</div>}
            <button type="submit" disabled={busy || !ready}>{busy ? "Updating…" : "Update password"} <ArrowRight size={18}/></button>
          </form>
        )}
        <div className="auth-switch"><Link href="/forgot-password">Request a new reset link</Link></div>
        <small>Password reset links are single-use and expire. Never forward the email to anyone.</small>
      </div>
    </div>
  );
}
