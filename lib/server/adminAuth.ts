/** Server-side admin assignment is an explicit Supabase Auth UUID allowlist. */
export function isAllowedAdmin(userId: string | null | undefined, configured?: string): boolean {
  if (!userId || !configured) return false;
  return configured.split(",").map(id => id.trim()).filter(Boolean).includes(userId);
}
