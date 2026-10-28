export const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
export const supabasePublishableKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();

export function getSupabaseConfigIssue(): string | null {
  if (!supabaseUrl || !supabasePublishableKey) {
    return "Supabase authentication is not configured for this deployment.";
  }

  let parsed: URL;
  try {
    parsed = new URL(supabaseUrl);
  } catch {
    return "The Supabase project URL is invalid. Check NEXT_PUBLIC_SUPABASE_URL.";
  }

  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(local && process.env.NODE_ENV !== "production")) {
    return "The Supabase project URL must use HTTPS.";
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    return "The Supabase project URL must be the base project URL, without credentials, query parameters or fragments.";
  }
  if (/^sb_secret_/i.test(supabasePublishableKey) || /service_role/i.test(supabasePublishableKey)) {
    return "A server-only Supabase secret was supplied as a public key. Replace it with the project's publishable/anon key.";
  }
  return null;
}

export function isSupabaseConfigured() {
  return getSupabaseConfigIssue() === null;
}
