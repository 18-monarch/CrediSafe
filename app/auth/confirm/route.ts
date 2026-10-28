import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/mvp/safeReturnPath";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set<EmailOtpType>([
  "signup", "invite", "magiclink", "recovery", "email_change", "email",
]);

function redirectTo(origin: string, path: string, error?: string) {
  const target = new URL(safeReturnPath(path, "/app/dashboard"), origin);
  const response = NextResponse.redirect(error
    ? new URL("/login?error=confirmation_failed", origin)
    : target);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

/**
 * Optional compatibility endpoint for Supabase email templates which use
 * token_hash/type rather than the default PKCE code exchange.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeReturnPath(url.searchParams.get("next"), "/app/dashboard");
  const tokenHash = url.searchParams.get("token_hash");
  const typeValue = url.searchParams.get("type");

  if (!tokenHash || !typeValue || !ALLOWED_TYPES.has(typeValue as EmailOtpType)) {
    return redirectTo(url.origin, "/app/dashboard", "invalid");
  }

  const supabase = await createClient();
  if (!supabase) return redirectTo(url.origin, "/app/dashboard", "config");

  try {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: typeValue as EmailOtpType,
    });
    return error ? redirectTo(url.origin, "/app/dashboard", "verify") : redirectTo(url.origin, next);
  } catch {
    return redirectTo(url.origin, "/app/dashboard", "verify");
  }
}
