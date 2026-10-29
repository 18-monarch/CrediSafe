import { NextResponse } from "next/server";
import {
  getSupabaseConfigIssue,
  isSupabaseConfigured,
  supabasePublishableKey,
  supabaseUrl,
} from "@/lib/supabase/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Read-only, low-detail Supabase Auth diagnostic.
 * It never returns the URL, key, provider response body, users, or auth records.
 */
export async function GET() {
  const noStore = { "Cache-Control": "no-store, private, max-age=0" };

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: false,
      stage: "configuration",
      code: "supabase_config_invalid",
      message: getSupabaseConfigIssue() ?? "Supabase authentication is not configured.",
    }, { status: 503, headers: noStore });
  }

  let response: Response;
  try {
    response = await fetch(new URL("/auth/v1/settings", supabaseUrl), {
      method: "GET",
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${supabasePublishableKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return NextResponse.json({
      ok: false,
      stage: "upstream",
      code: "auth_service_unreachable",
      message: "The website is configured, but it could not reach Supabase Auth.",
    }, { status: 503, headers: noStore });
  }

  if (!response.ok) {
    return NextResponse.json({
      ok: false,
      stage: "upstream",
      code: response.status === 401 || response.status === 403
        ? "supabase_rejected_public_key"
        : "auth_service_unhealthy",
      upstreamStatus: response.status,
      message: response.status === 401 || response.status === 403
        ? "Supabase Auth rejected the website's public key. Verify the URL/key pair in Vercel."
        : "Supabase Auth returned an unsuccessful health response.",
    }, { status: 503, headers: noStore });
  }

  let settings: {
    disable_signup?: unknown;
    mailer_autoconfirm?: unknown;
    external?: { email?: unknown };
  } | null = null;

  try {
    settings = await response.json();
  } catch {
    return NextResponse.json({
      ok: false,
      stage: "upstream",
      code: "invalid_auth_settings_response",
      message: "Supabase Auth responded, but its settings response could not be read.",
    }, { status: 503, headers: noStore });
  }

  return NextResponse.json({
    ok: true,
    stage: "ready",
    providerReachable: true,
    emailSignupsEnabled: typeof settings?.disable_signup === "boolean"
      ? !settings.disable_signup
      : null,
    emailPasswordProviderEnabled: typeof settings?.external?.email === "boolean"
      ? settings.external.email
      : null,
    emailConfirmationRequired: typeof settings?.mailer_autoconfirm === "boolean"
      ? !settings.mailer_autoconfirm
      : null,
    note: "This endpoint checks provider connectivity and public sign-up settings only. It does not test a real account or email delivery.",
  }, { headers: noStore });
}
