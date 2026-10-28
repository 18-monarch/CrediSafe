import assert from "node:assert/strict";
import test from "node:test";
import { validateSupabaseConfig } from "../lib/supabase/config";

const validUrl = "https://project-ref.supabase.co";
const publicKey = "sb_publishable_test-key";

test("valid HTTPS project URL and publishable key are accepted", () => {
  assert.equal(validateSupabaseConfig(validUrl, publicKey, true), null);
});

test("missing and malformed Supabase settings fail closed", () => {
  assert.match(validateSupabaseConfig("", publicKey, true) ?? "", /not configured/i);
  assert.match(validateSupabaseConfig("not-a-url", publicKey, true) ?? "", /URL is invalid/i);
  assert.match(validateSupabaseConfig("http://project-ref.supabase.co", publicKey, true) ?? "", /HTTPS/i);
  assert.match(validateSupabaseConfig("https://user:pass@project-ref.supabase.co", publicKey, true) ?? "", /base project URL/i);
});

test("a Supabase secret key or service-role JWT is rejected from the browser config", () => {
  assert.match(validateSupabaseConfig(validUrl, "sb_secret_super-secret", true) ?? "", /server-only/i);
  const payload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
  assert.match(validateSupabaseConfig(validUrl, "eyJhbGciOiJub25lIn0." + payload + ".signature", true) ?? "", /server-only/i);
});

test("localhost HTTP is accepted only outside production", () => {
  assert.equal(validateSupabaseConfig("http://localhost:54321", publicKey, false), null);
  assert.match(validateSupabaseConfig("http://localhost:54321", publicKey, true) ?? "", /HTTPS/i);
});
