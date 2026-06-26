import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  if (!supabase) {
    return { error: "Supabase is not configured", status: 503 as const, supabase: null, user: null };
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { error: "Authentication required", status: 401 as const, supabase, user: null };
  }

  return { error: null, status: 200 as const, supabase, user: data.user };
}
