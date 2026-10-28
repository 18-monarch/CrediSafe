import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAuthSiteOrigin } from "@/lib/supabase/siteUrl";
import { getVisionServiceUrl } from "@/lib/server/vision";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const authConfigured = isSupabaseConfigured();
  const canonicalOrigin = getAuthSiteOrigin(new URL(request.url).origin);
  return NextResponse.json(
    {
      ok: true,
      service: "credisafe",
      version: "3.2.0",
      authConfigured,
      emailRedirectConfigured: Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim() && canonicalOrigin),
      visionConfigured: Boolean(getVisionServiceUrl()),
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
