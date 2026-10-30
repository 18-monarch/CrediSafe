import { createHash, createHmac } from "node:crypto";

const BACKEND_ORIGIN = "https://credisafeandroid.onrender.com";
const SECRET = process.env.CREDISAFE_ADMIN_BRIDGE_SECRET;

export type AdminBridgeResult<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
};

export async function callAdminBackend<T = unknown>(
  userId: string,
  path: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>,
  bootstrapOwner = false,
): Promise<AdminBridgeResult<T>> {
  if (!SECRET || SECRET.length < 32) {
    return { ok: false, status: 503, data: null, error: "Admin bridge is not configured." };
  }
  const [relativePath, queryString = ""] = path.split("?", 2);
  if (!relativePath.startsWith("/") || relativePath.includes("..") || relativePath.startsWith("//") ||
      path.split("?").length > 2) {
    return { ok: false, status: 400, data: null, error: "Invalid admin operation path." };
  }

  const timestamp = String(Date.now());
  const payloadBody = body ?? {};
  const serializedBody = JSON.stringify(payloadBody);
  const bodyHash = createHash("sha256").update(serializedBody).digest("hex");
  const signaturePayload = [
    method,
    relativePath,
    timestamp,
    userId,
    bootstrapOwner ? "1" : "0",
    bodyHash,
  ].join("\n");
  const signature = createHmac("sha256", SECRET).update(signaturePayload).digest("hex");

  try {
    const response = await fetch(`${BACKEND_ORIGIN}/v1/internal/admin${relativePath}${queryString ? `?${queryString}` : ""}`, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-admin-user-id": userId,
        "x-admin-timestamp": timestamp,
        "x-admin-signature": signature,
        "x-admin-bootstrap-owner": bootstrapOwner ? "true" : "false",
      },
      ...(method === "POST" ? { body: serializedBody } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const data = await response.json().catch(() => null);
    return {
      ok: response.ok,
      status: response.status,
      data: data as T | null,
      error: response.ok ? undefined : (typeof data?.error === "string" ? data.error : "Admin service rejected the request."),
    };
  } catch {
    return { ok: false, status: 503, data: null, error: "Unable to reach the admin service." };
  }
}

export type AdminBridgeHealth = {
  status: "ok" | "not_configured" | "rejected" | "unavailable";
  detail: string;
};

export async function checkLegacyBridgeSecret(): Promise<AdminBridgeHealth> {
  if (!SECRET || SECRET.length < 32) {
    return { status: "not_configured", detail: "Vercel bridge secret is missing or too short." };
  }
  try {
    const response = await fetch(`${BACKEND_ORIGIN}/v1/internal/overview`, {
      method: "GET",
      headers: {
        "x-credisafe-admin-bridge": SECRET,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    // Consume and immediately discard the de-identified overview. The setup
    // page receives only a boolean-like status and never operational records.
    await response.text();
    if (response.ok) {
      return { status: "ok", detail: "Render accepted the shared bridge credential and its read-only database query succeeded." };
    }
    if (response.status === 403 || response.status === 503) {
      return { status: "rejected", detail: "Render rejected or has not enabled the matching bridge credential." };
    }
    return { status: "unavailable", detail: `Render bridge probe returned HTTP ${response.status}.` };
  } catch {
    return { status: "unavailable", detail: "Render bridge could not be reached from this website deployment." };
  }
}
