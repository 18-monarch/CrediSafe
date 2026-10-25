import { requireUser } from "@/lib/server/auth";
import { isAllowedAdmin } from "@/lib/server/adminAuth";

export async function requireAdmin() {
  const auth = await requireUser();
  if (auth.error || !auth.user || !auth.supabase) {
    return { ok: false as const, status: auth.status, message: "Sign in to continue" };
  }
  if (!isAllowedAdmin(auth.user.id, process.env.CREDISAFE_ADMIN_USER_IDS)) {
    return { ok: false as const, status: 403 as const, message: "Admin access is restricted" };
  }
  // Team access requires Supabase MFA by default; never rely only on UI hiding.
  if (process.env.CREDISAFE_ADMIN_REQUIRE_MFA !== "false") {
    const result = await auth.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (result.error || result.data?.currentLevel !== "aal2") {
      return { ok: false as const, status: 403 as const, message: "Admin account requires MFA (AAL2)" };
    }
  }
  return { ok: true as const, status: 200 as const, userId: auth.user.id };
}
