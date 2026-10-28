/**
 * Use one canonical origin for auth confirmation/recovery links. Vercel
 * preview hosts are intentionally not selected automatically, since they
 * frequently aren't on Supabase's Auth redirect allow-list.
 */
export function getAuthSiteOrigin(fallbackOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const candidate = configured || fallbackOrigin || "";
  try {
    const parsed = new URL(candidate);
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !(local && process.env.NODE_ENV !== "production")) {
      return fallbackOrigin ? new URL(fallbackOrigin).origin : "";
    }
    if (parsed.username || parsed.password) return fallbackOrigin ? new URL(fallbackOrigin).origin : "";
    return parsed.origin;
  } catch {
    try { return fallbackOrigin ? new URL(fallbackOrigin).origin : ""; }
    catch { return ""; }
  }
}
