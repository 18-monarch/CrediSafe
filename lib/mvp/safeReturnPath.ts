/** Prevent unsafe router/HTTP redirects from untrusted query parameters. */
export function safeReturnPath(raw: string | null | undefined, fallback = "/app/dashboard"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") ||
      raw.includes("\\") || /[\u0000-\u001f\u007f]/.test(raw)) return fallback;

  try {
    const target = new URL(raw, "https://credisafe.invalid");
    if (target.origin !== "https://credisafe.invalid") return fallback;
    return target.pathname + target.search + target.hash;
  } catch {
    return fallback;
  }
}
