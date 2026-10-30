import assert from "node:assert/strict";
import test from "node:test";
import { hasAdminPermission } from "../lib/server/adminBridge";

test("owner has every operations permission", () => {
  for (const permission of ["overview:read","users:read","users:write","trips:read","xp:read","audit:read","team:read","team:manage","config:read","config:write","system:read"] as const) {
    assert.equal(hasAdminPermission("OWNER", permission), true);
  }
});

test("support can troubleshoot accounts and trips but cannot manage roles or configuration", () => {
  assert.equal(hasAdminPermission("SUPPORT","users:read"), true);
  assert.equal(hasAdminPermission("SUPPORT","users:write"), true);
  assert.equal(hasAdminPermission("SUPPORT","trips:read"), true);
  assert.equal(hasAdminPermission("SUPPORT","team:manage"), false);
  assert.equal(hasAdminPermission("SUPPORT","config:write"), false);
  assert.equal(hasAdminPermission("SUPPORT","audit:read"), false);
});

test("analyst and auditor roles are read-only and separated by purpose", () => {
  assert.equal(hasAdminPermission("ANALYST","xp:read"), true);
  assert.equal(hasAdminPermission("ANALYST","users:read"), false);
  assert.equal(hasAdminPermission("ANALYST","users:write"), false);
  assert.equal(hasAdminPermission("AUDITOR","audit:read"), true);
  assert.equal(hasAdminPermission("AUDITOR","config:write"), false);
  assert.equal(hasAdminPermission("AUDITOR","team:manage"), false);
});
