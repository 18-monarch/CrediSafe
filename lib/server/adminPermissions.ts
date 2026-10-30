export type AdminRole = "OWNER" | "ADMIN" | "SUPPORT" | "ANALYST" | "AUDITOR";
export type AdminPermission =
  | "overview:read" | "users:read" | "users:write" | "trips:read"
  | "xp:read" | "audit:read" | "team:read" | "team:manage"
  | "config:read" | "config:write" | "system:read";

export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  OWNER: ["overview:read","users:read","users:write","trips:read","xp:read","audit:read","team:read","team:manage","config:read","config:write","system:read"],
  ADMIN: ["overview:read","users:read","users:write","trips:read","xp:read","audit:read","team:read","config:read","config:write","system:read"],
  SUPPORT: ["overview:read","users:read","users:write","trips:read","system:read"],
  ANALYST: ["overview:read","trips:read","xp:read","system:read"],
  AUDITOR: ["overview:read","trips:read","audit:read","team:read","config:read","system:read"],
};

export function hasAdminPermission(role: AdminRole, permission: AdminPermission): boolean {
  return ADMIN_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ADMIN_ROLE_PERMISSIONS, value);
}
