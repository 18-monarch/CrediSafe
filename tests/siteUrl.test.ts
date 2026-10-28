import assert from "node:assert/strict";
import test from "node:test";
import { getAuthSiteOrigin } from "../lib/supabase/siteUrl";

test("auth callbacks use the canonical configured origin, not a preview origin", () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://credi-safe.vercel.app/";
  try {
    assert.equal(getAuthSiteOrigin("https://preview-123.vercel.app"), "https://credi-safe.vercel.app");
  } finally {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = original;
  }
});

test("invalid configured origins fall back only to a valid supplied origin", () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "javascript:alert(1)";
  try {
    assert.equal(getAuthSiteOrigin("https://credi-safe.vercel.app/path"), "https://credi-safe.vercel.app");
  } finally {
    if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = original;
  }
});
