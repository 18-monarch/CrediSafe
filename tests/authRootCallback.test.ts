import assert from "node:assert/strict";
import test from "node:test";
import { getAuthRootCallbackTarget } from "../lib/mvp/authRootCallback";

test("legacy root confirmation code is sent to the server callback", () => {
  const target = getAuthRootCallbackTarget("?code=one-time-code");
  assert.ok(target);

  const url = new URL(target, "https://credi-safe.vercel.app");
  assert.equal(url.pathname, "/auth/callback");
  assert.equal(url.searchParams.get("code"), "one-time-code");
  assert.equal(url.searchParams.get("next"), "/app/dashboard");
});

test("provider callback errors are forwarded without raw descriptions", () => {
  const target = getAuthRootCallbackTarget(
    "?error=access_denied&error_code=otp_expired&error_description=private-details&redirect_to=https%3A%2F%2Fevil.example",
  );
  assert.ok(target);

  const url = new URL(target, "https://credi-safe.vercel.app");
  assert.equal(url.pathname, "/auth/callback");
  assert.equal(url.searchParams.get("error"), "access_denied");
  assert.equal(url.searchParams.get("error_code"), "otp_expired");
  assert.equal(url.searchParams.get("error_description"), null);
  assert.equal(url.searchParams.get("redirect_to"), null);
  assert.equal(url.searchParams.get("next"), "/app/dashboard");
});

test("ordinary home-page URLs are not redirected", () => {
  assert.equal(getAuthRootCallbackTarget("?ref=homepage"), null);
  assert.equal(getAuthRootCallbackTarget(""), null);
});
