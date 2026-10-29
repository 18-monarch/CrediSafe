import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfigIssue } from "@/lib/supabase/config";
import { getAuthCallbackFailureCode } from "@/lib/supabase/authMessages";
import { getAuthSiteOrigin } from "@/lib/supabase/siteUrl";
import { safeReturnPath } from "@/lib/mvp/safeReturnPath";

export const dynamic = "force-dynamic";

function logCallbackFailure(stage: string, code: string, error?: unknown) {
  // Safe diagnostic only: never log email addresses, provider descriptions,
  // callback query strings, one-time codes, session cookies, or tokens.
  console.warn("[credisafe-auth-callback]", {
    stage,
    code,
    errorName: error instanceof Error ? error.name : undefined,
  });
}

function redirectToOrigin(origin: string, path: string, error?: string) {
  if (error) {
    const login = new URL("/login", origin);
    login.searchParams.set("error", error);
    const failed = NextResponse.redirect(login);
    failed.headers.set("Cache-Control", "private, no-store, max-age=0");
    failed.headers.set("Referrer-Policy", "no-referrer");
    return failed;
  }

  const target = new URL(safeReturnPath(path, "/app/dashboard"), origin);
  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getAuthSiteOrigin(url.origin) || url.origin;
  const next = safeReturnPath(url.searchParams.get("next"), "/app/dashboard");

  // Supabase can return provider errors instead of a one-time authorization code.
  if (url.searchParams.has("error") || url.searchParams.has("error_code")) {
    const providerError = [
      url.searchParams.get("error_code"),
      url.searchParams.get("error"),
      url.searchParams.get("error_description"),
    ].filter(Boolean).join(" ");
    const failureCode = getAuthCallbackFailureCode(providerError);
    logCallbackFailure("provider-return", failureCode);
    return redirectToOrigin(origin, "/login", failureCode);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    const failureCode = getSupabaseConfigIssue() ? "auth_unavailable" : "confirmation_failed";
    logCallbackFailure("missing-code", failureCode);
    return redirectToOrigin(origin, "/login", failureCode);
  }

  const supabase = await createClient();
  if (!supabase) {
    logCallbackFailure("client-unavailable", "auth_unavailable");
    return redirectToOrigin(origin, "/login", "auth_unavailable");
  }

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const failureCode = getAuthCallbackFailureCode(error);
      logCallbackFailure("code-exchange", failureCode, error);
      return redirectToOrigin(origin, "/login", failureCode);
    }
    return redirectToOrigin(origin, next);
  } catch (error) {
    const failureCode = getAuthCallbackFailureCode(error);
    logCallbackFailure("exception", failureCode, error);
    return redirectToOrigin(origin, "/login", failureCode);
  }
}
