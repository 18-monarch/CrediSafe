import { NextRequest, NextResponse } from "next/server";
import { adminBridgeFetch, requireAdmin } from "@/lib/server/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
  const admin = await requireAdmin("overview:read");
  const headers = { "Cache-Control": "no-store, private" };
  if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: admin.status, headers });
  try {
    const result = await adminBridgeFetch("/overview", admin);
    return NextResponse.json(result.data ?? {}, { status: result.response.status, headers });
  } catch {
    return NextResponse.json({ error: "Android monitoring source is unavailable" }, { status: 503, headers });
  }
}
