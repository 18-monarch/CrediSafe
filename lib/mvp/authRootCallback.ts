/**
 * Recover PKCE confirmation links created by older email templates which
 * redirect to the canonical site root instead of /auth/callback.
 *
 * Only copy fields understood by the callback route. In particular, never
 * honour a redirect_to/next value supplied by the email URL.
 */
export function getAuthRootCallbackTarget(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const code = params.get("code");
  const error = params.get("error");
  const errorCode = params.get("error_code");

  if (!code && !error && !errorCode) return null;

  const callback = new URLSearchParams();
  if (code) callback.set("code", code);
  if (error) callback.set("error", error);
  if (errorCode) callback.set("error_code", errorCode);
  callback.set("next", "/app/dashboard");

  return `/auth/callback?${callback.toString()}`;
}
