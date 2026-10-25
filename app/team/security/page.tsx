import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedAdmin } from "@/lib/server/adminAuth";
import { TeamMfaSetup } from "@/components/admin/TeamMfaSetup";

export const dynamic = "force-dynamic";

export default async function TeamSecurityPage() {
  const supabase = await createClient();
  if (!supabase) return <p>Team security requires Supabase.</p>;
  const result = await supabase.auth.getUser();
  if (!result.data.user) redirect("/login?next=%2Fteam%2Fsecurity");
  if (!isAllowedAdmin(result.data.user.id, process.env.CREDISAFE_ADMIN_USER_IDS)) {
    return <main style={{padding:48}}><h1>Restricted</h1><Link href="/">Return home</Link></main>;
  }
  return <TeamMfaSetup />;
}
