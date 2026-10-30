import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isApprovedAdminIdentity } from "@/lib/server/adminBridge";
import { TeamMfaSetup } from "@/components/admin/TeamMfaSetup";

export const dynamic = "force-dynamic";

export default async function TeamSecurityPage() {
  const supabase = await createClient();
  if (!supabase) return <p>Team security requires Supabase.</p>;
  const result = await supabase.auth.getUser();
  if (!result.data.user) redirect("/login?next=%2Fteam%2Fsecurity");
  const approved = await isApprovedAdminIdentity(result.data.user.id);
  if (!approved) {
    return <main style={{padding:48}}>
      <h1>Restricted team security</h1>
      <p>Your Supabase account has not been approved for the CrediSafe team.</p>
      <Link href="/">Return home</Link>
    </main>;
  }
  return <TeamMfaSetup />;
}
