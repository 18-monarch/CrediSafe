import assert from "node:assert/strict";
import test from "node:test";
import { safeReturnPath } from "../lib/mvp/safeReturnPath";

test("login return path permits only site-local paths",()=>{
  assert.equal(safeReturnPath("/admin"),"/admin");
  assert.equal(safeReturnPath("/app/dashboard"),"/app/dashboard");
  assert.equal(safeReturnPath("https://example.com"),"/app/dashboard");
  assert.equal(safeReturnPath("//attacker.com"),"/app/dashboard");
  assert.equal(safeReturnPath("javascript:alert(1)"),"/app/dashboard");
  assert.equal(safeReturnPath("/\\attacker"),"/app/dashboard");
});
