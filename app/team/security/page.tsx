import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedAdmin } from "@/lib/server/adminAuth";
import { callAdminBackend } from "@/lib/server/adminBridge";
import { TeamMfaSetup } from "@/components/admin/TeamMfaSetup";

export const dynamic = "force-dynamic";

export default async function TeamSecurityPage() {
  const supabase = await createClient();
  if (!supabase) return <p>Team security requires Supabase.</p>;
  const result = await supabase.auth.getUser();
  if (!result.data.user) redirect("/login?next=%2Fteam%2Fsecurity");

  // Permit initial Owner bootstrap and already-approved team members to enroll
  // MFA. Full admin routes still require AAL2 through requireAdmin().
  const membership = await callAdminBackend(
    result.data.user.id,
    "/authz",
    "GET",
    undefined,
    isAllowedAdmin(result.data.user.id, process.env.CREDISAFE_ADMIN_USER_IDS),
  );
  if (!membership.ok) {
    return <main style={{padding:48,background:"#09121a",color:"#ecf5f3",minHeight:"100vh"}}>
      <h1>Restricted team area</h1>
      <p>{membership.error || "Your account is not approved for CrediSafe team access."}</p>
      <Link href="/">Return to CrediSafe</Link>
    </main>;
  }
  return <TeamMfaSetup />;
}
