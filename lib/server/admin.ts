import { requireUser } from "@/lib/server/auth";
import { isAllowedAdmin } from "@/lib/server/adminAuth";
import { callAdminBackend } from "@/lib/server/adminBridge";

export type AdminRole = "OWNER" | "ADMIN" | "SUPPORT" | "ANALYST" | "AUDITOR";

export async function requireAdmin() {
  const auth = await requireUser();
  if (auth.error || !auth.user || !auth.supabase) {
    return { ok: false as const, status: auth.status, message: "Sign in to continue" };
  }

  // Admin access always requires an elevated Supabase MFA assurance level.
  if (process.env.CREDISAFE_ADMIN_REQUIRE_MFA !== "false") {
    const result = await auth.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (result.error || result.data?.currentLevel !== "aal2") {
      return { ok: false as const, status: 403 as const, message: "Admin account requires MFA (AAL2)" };
    }
  }

  // This exact UUID allowlist is only the initial Owner bootstrap. Subsequent
  // team access is checked against the Neon admin_members table by the backend.
  const bootstrapOwner = isAllowedAdmin(auth.user.id, process.env.CREDISAFE_ADMIN_USER_IDS);
  const result = await callAdminBackend<{ userId: string; role: AdminRole; mfaEnforced: boolean }>(
    auth.user.id,
    "/authz",
    "GET",
    undefined,
    bootstrapOwner,
  );
  if (!result.ok || !result.data?.role) {
    return {
      ok: false as const,
      status: result.status === 401 || result.status === 403 ? 403 as const : 503 as const,
      message: result.error || "Admin authorization service is unavailable",
    };
  }
  return {
    ok: true as const,
    status: 200 as const,
    userId: auth.user.id,
    role: result.data.role,
  };
}
