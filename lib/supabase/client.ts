"use client";

import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "./config";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!isSupabaseConfigured()) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        // Passkey methods are opt-in in supabase-js and gated by project settings.
        experimental: { passkey: true },
      },
    });
  }
  return browserClient;
}
