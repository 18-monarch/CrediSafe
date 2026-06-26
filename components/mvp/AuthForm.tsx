"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, LockKeyhole, Mail, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!configured) {
      router.push("/app/dashboard");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(params.get("next") || "/app/dashboard");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/app/dashboard`,
          },
        });
        if (error) throw error;
        if (data.session) {
          router.push("/app/dashboard");
          router.refresh();
        } else {
          setMessage("Account created. Check your email to confirm the address, then sign in.");
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <Link href="/" className="auth-brand" aria-label="CrediSafe home">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/brand/credisafe-logo.png" alt="CrediSafe" /></Link>
      <div className="auth-card">
        <span className="auth-eyebrow">{configured ? "Secure product access" : "Local access"}</span>
        <h1>{mode === "login" ? "Welcome back." : "Create your driver account."}</h1>
        <p>{configured ? "Access trips, scores, XP, rewards and leaderboard progress." : "Supabase is not configured, so CrediSafe opens in persistent local mode."}</p>

        <form onSubmit={submit}>
          {mode === "signup" && <label><span>Full name</span><div><UserRound size={18} /><input value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} /></div></label>}
          <label><span>Email</span><div><Mail size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required={configured} disabled={!configured} placeholder={configured ? "you@example.com" : "Not required in demo mode"} /></div></label>
          <label><span>Password</span><div><LockKeyhole size={18} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required={configured} minLength={6} disabled={!configured} placeholder={configured ? "Minimum 6 characters" : "Not required in demo mode"} /></div></label>
          {message && <div className="auth-message">{message}</div>}
          <button disabled={busy}>{busy ? "Please wait…" : configured ? (mode === "login" ? "Sign in" : "Create account") : "Enter working demo"}<ArrowRight size={18} /></button>
        </form>

        <div className="auth-switch">
          {mode === "login" ? <>New to CrediSafe? <Link href="/signup">Create an account</Link></> : <>Already registered? <Link href="/login">Sign in</Link></>}
        </div>
        <small>FASTag and external vehicle integrations remain simulated until official access is available.</small>
      </div>
    </div>
  );
}
