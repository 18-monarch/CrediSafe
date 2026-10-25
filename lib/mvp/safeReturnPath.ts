/** Prevent unsafe router.push() destinations from untrusted query parameters. */
export function safeReturnPath(raw: string | null | undefined, fallback = "/app/dashboard") {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") ||
      raw.includes("\\") || /[\r\n\t]/.test(raw)) return fallback;
  return raw;
}
