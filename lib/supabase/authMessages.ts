const REDIRECT_MESSAGES: Record<string, string> = {
  confirmation_failed: "This authentication link could not be verified. It may have expired or already been used. Request a new link or use password recovery.",
  auth_unavailable: "Secure sign-in is temporarily unavailable. Please try again later.",
  password_updated: "Your password has been updated. Sign in with your new password.",
  recovery_link_failed: "This password-recovery link is invalid or expired. Request a new reset email and open the newest message.",
  link_failed: "This email link could not be verified. Request a new link and try again.",
};

export function getAuthRedirectMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return REDIRECT_MESSAGES[code] ?? REDIRECT_MESSAGES.link_failed;
}

export function getFriendlyAuthError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const message = raw.toLowerCase();

  if (/invalid login credentials|invalid email or password|invalid grant/.test(message)) {
    return "Email or password is incorrect. Check your details or use Forgot password.";
  }
  if (/email not confirmed|email_not_confirmed/.test(message)) {
    return "Please confirm your email from the latest CrediSafe email before signing in. Check spam/junk too.";
  }
  if (/otp_expired|expired.*(token|link|otp)|invalid.*(token|otp|link)|token.*(expired|invalid)/.test(message)) {
    return "That link or code is invalid or expired. Request a fresh email and open the newest message.";
  }
  if (/rate limit|too many requests|429|email rate limit/.test(message)) {
    return "Too many attempts were made in a short time. Wait a few minutes before trying again.";
  }
  if (/password.*(at least|characters|weak|strength)|weak password/.test(message)) {
    return "Choose a stronger password with at least 8 characters, then try again.";
  }
  if (/user already registered|already registered|user_already_exists/.test(message)) {
    return "An account may already exist for that address. Try signing in or use Forgot password.";
  }
  if (/email.*(invalid|valid)|invalid.*email/.test(message)) {
    return "Enter a valid email address and try again.";
  }
  if (/redirect.*(not allowed|allowlist|allow list|url)|redirect_uri/.test(message)) {
    return "The email redirect is not allow-listed in Supabase. The administrator must add https://credi-safe.vercel.app/auth/callback under Authentication → URL Configuration.";
  }
  if (/failed to fetch|fetch failed|network|load failed|timeout|timed out|connection/.test(message)) {
    return "Could not reach the authentication service. Check your connection and try again.";
  }
  return "We couldn't complete that request. Please try again; if it keeps failing, contact the CrediSafe team.";
}
