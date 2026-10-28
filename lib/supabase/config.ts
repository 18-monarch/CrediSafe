export const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
export const supabasePublishableKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();

function isServerOnlyKey(key: string): boolean {
  if (/^sb_secret_/i.test(key) || /service_role/i.test(key)) return true;
  const segments = key.split(".");
  if (segments.length !== 3) return false;
  try {
    const base64 = segments[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="))) as { role?: unknown };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

export function validateSupabaseConfig(
  url: string,
  publishableKey: string,
  production = process.env.NODE_ENV === "production",
): string | null {
  const cleanUrl = url.trim();
  const cleanKey = publishableKey.trim();
  if (!cleanUrl || !cleanKey) {
    return "Supabase authentication is not configured for this deployment.";
  }

  let parsed: URL;
  try {
    parsed = new URL(cleanUrl);
  } catch {
    return "The Supabase project URL is invalid. Check NEXT_PUBLIC_SUPABASE_URL.";
  }

  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(local && !production)) {
    return "The Supabase project URL must use HTTPS.";
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    return "The Supabase project URL must be the base project URL, without credentials, query parameters or fragments.";
  }
  if (isServerOnlyKey(cleanKey)) {
    return "A server-only Supabase secret was supplied as a public key. Replace it with the project's publishable/anon key immediately.";
  }
  return null;
}

export function getSupabaseConfigIssue(): string | null {
  return validateSupabaseConfig(supabaseUrl, supabasePublishableKey);
}

export function isSupabaseConfigured() {
  return getSupabaseConfigIssue() === null;
}
