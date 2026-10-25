import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedAdmin } from "../lib/server/adminAuth";

test("unconfigured admin allowlist fails closed", () => {
  assert.equal(isAllowedAdmin("user-uuid", undefined), false);
  assert.equal(isAllowedAdmin("user-uuid", ""), false);
});
test("only exact explicitly-listed user ids have access", () => {
  assert.equal(isAllowedAdmin("uuid-2", "uuid-1,uuid-2"), true);
  assert.equal(isAllowedAdmin("uuid", "uuid-1,uuid-2"), false);
  assert.equal(isAllowedAdmin("uuid-2-hijack", "uuid-1,uuid-2"), false);
  assert.equal(isAllowedAdmin(undefined, "uuid-2"), false);
});
