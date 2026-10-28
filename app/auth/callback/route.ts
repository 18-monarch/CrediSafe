import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfigIssue } from "@/lib/supabase/config";
import { safeReturnPath } from "@/lib/mvp/safeReturnPath";

export const dynamic = "force-dynamic";

function redirectToOrigin(origin: string, path: string, error?: string) {
  const target = new URL(safeReturnPath(path, "/app/dashboard"), origin);
  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  if (error) {
    // Do not echo provider error descriptions or tokens into the user's URL.
    const login = new URL("/login", origin);
    login.searchParams.set("error", error);
    const failed = NextResponse.redirect(login);
    failed.headers.set("Cache-Control", "private, no-store, max-age=0");
    failed.headers.set("Referrer-Policy", "no-referrer");
    return failed;
  }
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeReturnPath(url.searchParams.get("next"), "/app/dashboard");

  // Supabase can send provider error parameters instead of an auth code.
  if (url.searchParams.has("error") || url.searchParams.has("error_code")) {
    return redirectToOrigin(url.origin, "/login", "link_failed");
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return redirectToOrigin(
      url.origin,
      "/login",
      getSupabaseConfigIssue() ? "auth_unavailable" : "confirmation_failed",
    );
  }

  const supabase = await createClient();
  if (!supabase) return redirectToOrigin(url.origin, "/login", "auth_unavailable");

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return redirectToOrigin(url.origin, "/login", "confirmation_failed");
    return redirectToOrigin(url.origin, next);
  } catch {
    return redirectToOrigin(url.origin, "/login", "confirmation_failed");
  }
}
