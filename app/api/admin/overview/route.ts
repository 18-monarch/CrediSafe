import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdmin();
  const headers = { "Cache-Control": "no-store, private" };
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status, headers });

  const secret = process.env.CREDISAFE_ADMIN_BRIDGE_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json({
      error: "Android monitoring bridge not configured. Add the same secret to Render and Vercel.",
    }, { status: 503, headers });
  }

  try {
    // Fixed trusted origin: never take proxy URLs from browser parameters.
    const response = await fetch("https://credisafeandroid.onrender.com/v1/internal/overview", {
      method: "GET",
      headers: { "x-credisafe-admin-bridge": secret, "Accept": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Android monitoring source is unavailable" },
        { status: 503, headers });
    }
    return NextResponse.json(await response.json(), { headers });
  } catch {
    return NextResponse.json({ error: "Unable to connect to Android monitoring backend" },
      { status: 503, headers });
  }
}
