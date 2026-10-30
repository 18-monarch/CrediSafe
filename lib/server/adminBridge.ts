import { requireUser } from "@/lib/server/auth";
import { isAllowedAdmin } from "@/lib/server/adminAuth";
import { hasAdminPermission, isAdminRole } from "@/lib/server/adminPermissions";
import type { AdminRole, AdminPermission } from "@/lib/server/adminPermissions";

const BRIDGE_ORIGIN = "https://credisafeandroid.onrender.com";

async function bridge(path: string, init: RequestInit = {}) {
  const secret = process.env.CREDISAFE_ADMIN_BRIDGE_SECRET;
  if (!secret || secret.length < 32) throw new Error("ADMIN_BRIDGE_NOT_CONFIGURED");
  const response = await fetch(new URL(`/v1/internal${path}`, BRIDGE_ORIGIN), {
    ...init,
    headers: {
      "x-credisafe-admin-bridge": secret,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export async function requireAdmin(permission: AdminPermission = "overview:read") {
  const auth = await requireUser();
  if (auth.error || !auth.user || !auth.supabase) {
    return { ok: false as const, status: auth.status, message: "Sign in to continue" };
  }

  if (process.env.CREDISAFE_ADMIN_REQUIRE_MFA !== "false") {
    try {
      const assurance = await auth.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error || assurance.data?.currentLevel !== "aal2") {
        return { ok: false as const, status: 403 as const, message: "Admin account requires verified MFA (AAL2)." };
      }
    } catch {
      return { ok: false as const, status: 503 as const, message: "Unable to verify admin MFA. Please retry." };
    }
  }

  const isBootstrapOwner = isAllowedAdmin(auth.user.id, process.env.CREDISAFE_ADMIN_USER_IDS);
  let role: AdminRole | null = null;
  try {
    const lookup = await bridge(`/team/member/${encodeURIComponent(auth.user.id)}`);
    const activeMember = lookup.response.ok && lookup.data?.member?.status === "ACTIVE";
    if (isBootstrapOwner && (!activeMember || lookup.data?.member?.role !== "OWNER")) {
      if (!lookup.response.ok && lookup.response.status !== 404) {
        return { ok: false as const, status: 503 as const, message: "Unable to verify the Owner membership. Please retry." };
      }
      const boot = await bridge("/team/bootstrap-owner", {
        method: "POST",
        body: JSON.stringify({ userId: auth.user.id }),
      });
      if (!boot.response.ok) {
        return { ok: false as const, status: boot.response.status === 409 ? 403 as const : 503 as const,
          message: boot.data?.error || "Owner bootstrap is not available." };
      }
      role = "OWNER";
    } else {
      if (!activeMember) {
        return { ok: false as const, status: 403 as const, message: "Admin access is restricted. Ask an Owner to approve your account." };
      }
      role = lookup.data.member.role as AdminRole;
      if (!isAdminRole(role)) role = null;
    }
  } catch (error) {
    const message = error instanceof Error && error.message === "ADMIN_BRIDGE_NOT_CONFIGURED"
      ? "Admin monitoring is not configured. The server-side bridge secret must match on Vercel and Render."
      : "Unable to verify admin membership. Please retry.";
    return { ok: false as const, status: 503 as const, message };
  }

  if (!role || !hasAdminPermission(role, permission)) {
    return { ok: false as const, status: 403 as const, message: "Your admin role does not allow this action." };
  }

  return { ok: true as const, status: 200 as const, userId: auth.user.id, role };
}

export async function adminBridgeFetch(
  path: string,
  admin: { userId: string; role: AdminRole },
  init: RequestInit = {},
) {
  return bridge(path, {
    ...init,
    headers: {
      "x-credisafe-admin-user-id": admin.userId,
      "x-credisafe-admin-role": admin.role,
      ...(init.headers ?? {}),
    },
  });
}


/** Allows an invited member to reach MFA enrollment without granting admin data access. */
export async function isApprovedAdminIdentity(userId: string): Promise<boolean> {
  try {
    const lookup = await bridge(`/team/member/${encodeURIComponent(userId)}`);
    if (lookup.response.ok && lookup.data?.member?.status === "ACTIVE") {
      return isAllowedAdmin(userId, process.env.CREDISAFE_ADMIN_USER_IDS)
        ? lookup.data.member.role === "OWNER"
        : true;
    }
    if (!isAllowedAdmin(userId, process.env.CREDISAFE_ADMIN_USER_IDS)) return false;
    if (!lookup.response.ok && lookup.response.status !== 404) return false;
    const result = await bridge("/team/bootstrap-owner", {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
    return result.response.ok;
  } catch {
    return false;
  }
}
