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
