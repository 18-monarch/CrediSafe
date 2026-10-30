import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin";
import { callAdminBackend } from "@/lib/server/adminBridge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = { "Cache-Control": "no-store, private", "Vary": "Cookie" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers });
}

function backendPath(resource: string, params: URLSearchParams): string | null {
  const id = params.get("id") || "";
  switch (resource) {
    case "overview": return "/overview";
    case "users": return `/users${params.get("q") ? `?q=${encodeURIComponent(params.get("q")!)}` : ""}${params.get("status") ? `${params.get("q") ? "&" : "?"}status=${encodeURIComponent(params.get("status")!)}` : ""}`;
    case "user": return /^[0-9a-f-]{36}$/i.test(id) ? `/users/${id}` : null;
    case "trips": {
      const q = new URLSearchParams();
      if (params.get("q")) q.set("q", params.get("q")!);
      if (params.get("status")) q.set("status", params.get("status")!);
      return `/trips${q.size ? `?${q.toString()}` : ""}`;
    }
    case "trip": return /^[0-9a-f-]{36}$/i.test(id) ? `/trips/${id}` : null;
    case "xp": return `/xp/ledger${params.get("userId") ? `?userId=${encodeURIComponent(params.get("userId")!)}` : ""}`;
    case "config": return "/config";
    case "team": return "/team";
    case "audit": return "/audit";
    case "releases": return "/releases";
    case "health": return "/health";
    default: return null;
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return json({ error: auth.message }, auth.status);

  const resource = request.nextUrl.searchParams.get("resource") || "overview";
  const path = backendPath(resource, request.nextUrl.searchParams);
  if (!path) return json({ error: "Unknown admin resource or invalid resource ID" }, 400);

  const response = await callAdminBackend(auth.userId, path, "GET");
  if (!response.ok) return json({ error: response.error || "Admin data unavailable" }, response.status);
  return json({ ...((response.data && typeof response.data === "object") ? response.data : {}), adminRole: auth.role });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return json({ error: "Cross-origin administrative requests are not accepted" }, 403);
  }

  const auth = await requireAdmin();
  if (!auth.ok) return json({ error: auth.message }, auth.status);

  let input: Record<string, unknown>;
  try {
    input = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid body");
  } catch {
    return json({ error: "A valid JSON request body is required" }, 400);
  }

  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  const action = typeof input.action === "string" ? input.action : "";
  if (reason.length < 8 || reason.length > 500) {
    return json({ error: "A reason between 8 and 500 characters is required for every administrative change" }, 400);
  }

  let path: string;
  let body: Record<string, unknown>;
  const userId = typeof input.userId === "string" ? input.userId : "";
  const validId = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

  switch (action) {
    case "suspend-user":
      if (!validId(userId)) return json({ error: "Invalid user ID" }, 400);
      path = `/users/${userId}/suspend`; body = { reason }; break;
    case "restore-user":
      if (!validId(userId)) return json({ error: "Invalid user ID" }, 400);
      path = `/users/${userId}/restore`; body = { reason }; break;
    case "revoke-sessions":
      if (!validId(userId)) return json({ error: "Invalid user ID" }, 400);
      path = `/users/${userId}/revoke-sessions`; body = { reason }; break;
    case "adjust-xp": {
      const delta = Number(input.delta);
      if (!validId(userId) || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 500) {
        return json({ error: "Invalid user ID or XP adjustment (range -500 to +500)" }, 400);
      }
      path = "/xp/adjust";
      body = { userId, delta, reason, requestId: randomUUID() };
      break;
    }
    case "update-config":
      if (typeof input.key !== "string") return json({ error: "Configuration key required" }, 400);
      path = "/config"; body = { key: input.key, value: input.value, reason }; break;
    case "upsert-team-member":
      if (!validId(userId) || typeof input.role !== "string" ||
          !["OWNER", "ADMIN", "SUPPORT", "ANALYST", "AUDITOR"].includes(input.role)) {
        return json({ error: "Valid team member UUID and role required" }, 400);
      }
      if (userId === auth.userId && input.status === "REVOKED") {
        return json({ error: "You cannot revoke your own admin membership" }, 400);
      }
      path = "/team"; body = { userId, role: input.role, status: input.status === "REVOKED" ? "REVOKED" : "ACTIVE", reason }; break;
    default:
      return json({ error: "Unsupported administrative operation" }, 400);
  }

  const response = await callAdminBackend(auth.userId, path, "POST", body);
  if (!response.ok) return json({ error: response.error || "Administrative operation failed" }, response.status);
  return json(response.data || { success: true });
}
