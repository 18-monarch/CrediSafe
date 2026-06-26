import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getVisionServiceUrl } from "@/lib/server/vision";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "credisafe",
    version: "2.0.0",
    backendMode: isSupabaseConfigured() ? "supabase" : "local-demo",
    visionConfigured: Boolean(getVisionServiceUrl()),
    timestamp: new Date().toISOString(),
  });
}
