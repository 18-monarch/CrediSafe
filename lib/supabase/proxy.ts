import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "./config";

function redirectPreservingCookies(destination: URL, sessionResponse: NextResponse) {
  const response = NextResponse.redirect(destination);
  // A refresh can rotate or clear auth cookies. Preserve them on redirects too.
  for (const cookie of sessionResponse.cookies.getAll()) response.cookies.set(cookie);
  for (const name of ["cache-control", "pragma", "expires", "vary"]) {
    const value = sessionResponse.headers.get(name);
    if (value) response.headers.set(name, value);
  }
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

function loginUrl(request: NextRequest, error?: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", request.nextUrl.pathname);
  if (error) url.searchParams.set("error", error);
  return url;
}

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtectedApp = path === "/app" || path.startsWith("/app/");
  const isProtectedAdmin = path === "/admin" || path.startsWith("/admin/");
  const isAuthPage = path === "/login" || path === "/signup" ||
    path === "/forgot-password" || path === "/reset-password";

  if (!isSupabaseConfigured()) {
    // Demo/local fallback must never silently disable auth in production.
    if (process.env.NODE_ENV === "production" && (isProtectedApp || isProtectedAdmin)) {
      const response = NextResponse.redirect(loginUrl(request, "auth_unavailable"));
      response.headers.set("Cache-Control", "private, no-store, max-age=0");
      return response;
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        if (headers) {
          for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
        }
        response.headers.set("Cache-Control", "private, no-store, max-age=0");
      },
    },
  });

  let hasValidSession = false;
  try {
    const { data, error } = await supabase.auth.getClaims();
    hasValidSession = !error && Boolean(data?.claims?.sub);
  } catch {
    // Fail closed for protected routes if session verification cannot complete.
  }

  if (!hasValidSession && (isProtectedApp || isProtectedAdmin)) {
    return redirectPreservingCookies(loginUrl(request), response);
  }

  if (hasValidSession && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/app/dashboard";
    url.search = "";
    return redirectPreservingCookies(url, response);
  }

  return response;
}
