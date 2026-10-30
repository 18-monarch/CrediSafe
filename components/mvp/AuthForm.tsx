"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Fingerprint, LockKeyhole, Mail, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfigIssue, isSupabaseConfigured } from "@/lib/supabase/config";
import { getAuthRedirectMessage, getFriendlyAuthError } from "@/lib/supabase/authMessages";
import { getAuthSiteOrigin } from "@/lib/supabase/siteUrl";
import { safeReturnPath } from "@/lib/mvp/safeReturnPath";

function authCallbackUrl(next: string) {
  const origin = getAuthSiteOrigin(typeof window === "undefined" ? undefined : window.location.origin);
  if (!origin) throw new Error("Secure email links cannot be created because the canonical website URL is not configured.");
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", safeReturnPath(next));
  return url.toString();
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const configured = isSupabaseConfigured();
  const passkeyEnabled = process.env.NEXT_PUBLIC_SUPABASE_PASSKEY_ENABLED === "true";
  // Local demo mode is convenient for development, but is never an auth bypass in production.
  const allowLocalDemo = process.env.NODE_ENV !== "production";

  const redirectError = params.get("error");
  const redirectSuccess = params.get("success");

  useEffect(() => {
    const redirectMessage = getAuthRedirectMessage(redirectError) ??
      (redirectSuccess ? getAuthRedirectMessage(redirectSuccess) : null);
    if (redirectMessage) {
      setMessage(redirectMessage);
    } else if (process.env.NODE_ENV === "production" && !configured) {
      setMessage(getSupabaseConfigIssue() ?? "Secure sign-in is temporarily unavailable.");
    }
  }, [redirectError, redirectSuccess, configured]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setAwaitingConfirmation(false);

    if (!configured) {
      if (allowLocalDemo) {
        router.replace("/app/dashboard");
        return;
      }
      setMessage(getSupabaseConfigIssue() ?? "Secure sign-in is temporarily unavailable.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setMessage("Secure sign-in is temporarily unavailable. Please try again later.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = fullName.trim();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;
        router.replace(safeReturnPath(params.get("next")));
        router.refresh();
      } else {
        if (normalizedName.length < 2) {
          setMessage("Enter your name so we can create your driver profile.");
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { full_name: normalizedName },
            emailRedirectTo: authCallbackUrl("/app/dashboard"),
          },
        });
        if (error) throw error;

        if (data.session) {
          router.replace("/app/dashboard");
          router.refresh();
        } else {
          const appearsNew = (data.user?.identities?.length ?? 1) > 0;
          setAwaitingConfirmation(appearsNew);
          setMessage(
            "If this address is eligible for registration, a confirmation email is on its way. Check spam/junk too. If no email arrives, try signing in or use Forgot password.",
          );
        }
      }
    } catch (error) {
      const authErrorText = error instanceof Error ? error.message.toLowerCase() : "";
      if (authErrorText.includes("email not confirmed") || authErrorText.includes("email_not_confirmed")) {
        setAwaitingConfirmation(true);
      }
      setMessage(getFriendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  async function signInWithPasskey() {
    const supabase = createClient();
    if (!supabase || !passkeyEnabled || mode !== "login") return;
    setPasskeyBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPasskey();
      if (error) throw error;
      router.replace(safeReturnPath(params.get("next"), "/app/dashboard"));
      router.refresh();
    } catch (error) {
      setMessage(getFriendlyAuthError(error));
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function resendConfirmation() {
    const supabase = createClient();
    const normalizedEmail = email.trim().toLowerCase();
    if (!supabase || !normalizedEmail) {
      setMessage("Enter the same email address used for registration.");
      return;
    }
    setResending(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: { emailRedirectTo: authCallbackUrl("/app/dashboard") },
      });
      if (error) throw error;
      setMessage("If a confirmation is needed for that account, a fresh email has been sent. Use the newest link.");
    } catch (error) {
      setMessage(getFriendlyAuthError(error));
    } finally {
      setResending(false);
    }
  }

  const unavailable = !configured && !allowLocalDemo;

  return (
    <div className="auth-shell">
      <Link href="/" className="auth-brand" aria-label="CrediSafe home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/credisafe-logo.png" alt="CrediSafe" />
      </Link>
      <div className="auth-card">
        <span className="auth-eyebrow">{configured ? "Secure product access" : unavailable ? "Secure sign-in unavailable" : "Local development demo"}</span>
        <h1>{mode === "login" ? "Welcome back." : "Create your driver account."}</h1>
        <p>
          {configured
            ? "Sign in to access your trips, profile and progress."
            : unavailable
              ? "CrediSafe cannot securely authenticate right now. Please try again later."
              : "Supabase is not configured, so this development build uses local demo data."}
        </p>

        <form onSubmit={submit}>
          {mode === "signup" && (
            <label htmlFor="credisafe-full-name">
              <span>Full name</span>
              <div><UserRound size={18} /><input id="credisafe-full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required minLength={2} maxLength={100} disabled={busy || unavailable} /></div>
            </label>
          )}
          <label htmlFor="credisafe-email">
            <span>Email address</span>
            <div><Mail size={18} /><input id="credisafe-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" autoCapitalize="none" spellCheck={false} required={configured} disabled={!configured || busy || unavailable} placeholder="you@example.com" /></div>
          </label>
          <label htmlFor="credisafe-password">
            <span>Password</span>
            <div><LockKeyhole size={18} /><input id="credisafe-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required={configured} minLength={mode === "signup" ? 8 : undefined} maxLength={128} disabled={!configured || busy || unavailable} placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"} /></div>
          </label>
          {message && <div className="auth-message" role="status" aria-live="polite">{message}</div>}
          <button disabled={busy || resending || unavailable}>
            {busy ? "Please wait…" : unavailable ? "Sign-in unavailable" : configured ? (mode === "login" ? "Sign in" : "Create account") : "Enter local demo"}
            <ArrowRight size={18} />
          </button>
        </form>

        {mode === "login" && configured && passkeyEnabled && (
          <button className="auth-secondary-button" type="button"
            disabled={busy || resending || passkeyBusy} onClick={signInWithPasskey}>
            <Fingerprint size={18} />
            {passkeyBusy ? "Waiting for passkey…" : "Sign in with passkey"}
          </button>
        )}

        {awaitingConfirmation && configured && (
          <button className="auth-secondary-button" type="button" disabled={resending || busy} onClick={resendConfirmation}>
            {resending ? "Requesting new email…" : "Resend confirmation email"}
          </button>
        )}

        <div className="auth-switch">
          {mode === "login" ? (
            <>
              <div><Link href="/forgot-password">Forgot password?</Link></div>
              <div className="auth-switch-secondary">New to CrediSafe? <Link href="/signup">Create an account</Link></div>
            </>
          ) : <>
            <div>Already registered? <Link href="/login">Sign in</Link></div>
            <div className="auth-switch-secondary">Having trouble accessing an account? <Link href="/forgot-password">Recover password</Link></div>
          </>}
        </div>
        <small>Never share your password or email confirmation link. External FASTag and vehicle integrations remain unavailable until officially connected.</small>
      </div>
    </div>
  );
}
