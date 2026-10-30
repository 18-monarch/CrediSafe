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
      <p>Your Supabase account has not been approved for the CrediSafe team yet.</p>
      <p>For the initial Owner, add this exact Auth UUID to the Vercel Production environment variable <code>CREDISAFE_ADMIN_USER_IDS</code>, then redeploy:</p>
      <pre style={{padding:16,background:"#111f28",borderRadius:12,overflowWrap:"anywhere"}}>{result.data.user.id}</pre>
      <p>For other team members, ask an Owner to grant a role from the Operations Center first. Then return here to enroll an authenticator and complete MFA.</p>
      <Link href="/">Return home</Link>
    </main>;
  }
  return <TeamMfaSetup />;
}
