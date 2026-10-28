import assert from "node:assert/strict";
import test from "node:test";
import { getAuthRedirectMessage, getFriendlyAuthError } from "../lib/supabase/authMessages";

test("callback errors are translated to safe, actionable messages", () => {
  assert.match(getAuthRedirectMessage("confirmation_failed") ?? "", /expired|used/i);
  assert.match(getAuthRedirectMessage("auth_unavailable") ?? "", /temporarily unavailable/i);
  assert.match(getAuthRedirectMessage("password_updated") ?? "", /updated/i);
  assert.equal(getAuthRedirectMessage(null), null);
  assert.ok(getAuthRedirectMessage("some-unexpected-provider-error"));
});

test("common credential failures get useful non-sensitive guidance", () => {
  assert.match(getFriendlyAuthError(new Error("Invalid login credentials")), /incorrect|Forgot password/i);
  assert.match(getFriendlyAuthError(new Error("Email not confirmed")), /confirm your email/i);
  assert.match(getFriendlyAuthError(new Error("Email rate limit exceeded")), /few minutes/i);
  assert.match(getFriendlyAuthError(new Error("Failed to fetch")), /connection/i);
  assert.match(getFriendlyAuthError(new Error("redirect URL not allowed")), /allow-listed/i);
});

test("unknown auth errors never return raw provider errors to users", () => {
  const raw = "Postgres connection host internal-secret-db.example failed";
  const friendly = getFriendlyAuthError(new Error(raw));
  assert.equal(friendly.includes("internal-secret-db"), false);
});
