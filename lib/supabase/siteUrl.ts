/**
 * Use one canonical origin for auth confirmation/recovery links. Vercel
 * preview hosts are intentionally not selected automatically when a canonical
 * URL is configured, since preview domains may not be on Supabase's allowlist.
 */
export function getAuthSiteOrigin(fallbackOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured) {
    try {
      const parsed = new URL(configured);
      const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      if (parsed.protocol !== "https:" && !(local && process.env.NODE_ENV !== "production")) return "";
      if (parsed.username || parsed.password || parsed.search || parsed.hash) return "";
      return parsed.origin;
    } catch {
      return "";
    }
  }

  try {
    const fallback = new URL(fallbackOrigin ?? "");
    const local = fallback.hostname === "localhost" || fallback.hostname === "127.0.0.1";
    if (fallback.protocol !== "https:" && !(local && process.env.NODE_ENV !== "production")) return "";
    if (fallback.username || fallback.password) return "";
    return fallback.origin;
  } catch {
    return "";
  }
}
