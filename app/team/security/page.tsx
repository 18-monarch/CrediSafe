import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedAdmin } from "@/lib/server/adminAuth";
import { callAdminBackend } from "@/lib/server/adminBridge";
import { TeamMfaSetup } from "@/components/admin/TeamMfaSetup";
import { AdminBootstrapInfo } from "@/components/admin/AdminBootstrapInfo";

export const dynamic = "force-dynamic";

export default async function TeamSecurityPage() {
  const supabase = await createClient();
  if (!supabase) return <p>Team security requires Supabase.</p>;
  const result = await supabase.auth.getUser();
  if (!result.data.user) redirect("/login?next=%2Fteam%2Fsecurity");

  const allowedToBootstrap = isAllowedAdmin(
    result.data.user.id,
    process.env.CREDISAFE_ADMIN_USER_IDS,
  );
  const membership = await callAdminBackend(
    result.data.user.id,
    "/authz",
    "GET",
    undefined,
    allowedToBootstrap,
  );

  if (!membership.ok) {
    return <AdminBootstrapInfo
      userId={result.data.user.id}
      allowlisted={allowedToBootstrap}
      message={membership.error || "This account is not yet approved for CrediSafe team access."}
    />;
  }

  return <TeamMfaSetup />;
}
