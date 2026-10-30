import { NextRequest, NextResponse } from "next/server";
import { adminBridgeFetch, requireAdmin, type AdminPermission } from "@/lib/server/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ path: string[] }> };

function requiredPermission(path: string[], method: string): AdminPermission | null {
  const root = path[0];
  if (root === "users") return method === "GET" ? "users:read" : "users:write";
  if (root === "trips") return "trips:read";
  if (root === "xp") return "xp:read";
  if (root === "audit") return "audit:read";
  if (root === "team") return method === "GET" ? "team:read" : "team:manage";
  if (root === "config") return method === "GET" ? "config:read" : "config:write";
  if (root === "system") return "system:read";
  return null;
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function handle(request: NextRequest, context: Context, method: string) {
  const { path } = await context.params;
  if (!path?.length || path.some(segment => !/^[a-zA-Z0-9._-]{1,128}$/.test(segment))) {
    return NextResponse.json({ error: "Invalid admin route" }, { status: 400 });
  }
  const permission = requiredPermission(path, method);
  if (!permission) return NextResponse.json({ error: "Admin route not found" }, { status: 404 });
  if (method !== "GET" && !sameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin admin actions are not allowed" }, { status: 403 });
  }

  const admin = await requireAdmin(permission);
  const headers = { "Cache-Control": "no-store, private" };
  if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: admin.status, headers });

  let body: string | undefined;
  if (method !== "GET") {
    const raw = await request.text();
    if (raw.length > 64000) return NextResponse.json({ error: "Request is too large" }, { status: 413, headers });
    try { JSON.parse(raw); body = raw; }
    catch { return NextResponse.json({ error: "A valid JSON body is required" }, { status: 400, headers }); }
  }

  const target = `/${path.map(encodeURIComponent).join("/")}${method === "GET" ? new URL(request.url).search : ""}`;
  try {
    const result = await adminBridgeFetch(target, admin, { method, ...(body ? { body } : {}) });
    const payload = result.data ?? {};
    return NextResponse.json(payload, { status: result.response.status, headers });
  } catch {
    return NextResponse.json({ error: "Admin service is temporarily unavailable" }, { status: 503, headers });
  }
}

export async function GET(request: NextRequest, context: Context) { return handle(request, context, "GET"); }
export async function POST(request: NextRequest, context: Context) { return handle(request, context, "POST"); }
export async function PATCH(request: NextRequest, context: Context) { return handle(request, context, "PATCH"); }
export async function PUT(request: NextRequest, context: Context) { return handle(request, context, "PUT"); }
