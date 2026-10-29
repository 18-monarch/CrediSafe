"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { getAuthRootCallbackTarget } from "@/lib/mvp/authRootCallback";

export function AuthRootCallbackBridge() {
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current) return;

    const target = getAuthRootCallbackTarget(search);
    if (!target) return;

    // Use a full same-origin navigation so the server callback can exchange
    // the PKCE code and set the HttpOnly session cookies correctly.
    hasRedirected.current = true;
    window.location.replace(target);
  }, [search]);

  return null;
}
