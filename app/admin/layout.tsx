import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/server/admin";
import "./admin.css";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  if (!admin.ok && admin.status === 401) redirect("/login?next=%2Fadmin");
  if (!admin.ok) {
    return (
      <main className="cc-locked">
        <h1>Restricted team area</h1>
        <p>{admin.message}. This page never shows driver records without verified team access.</p>
        <p>Team members need explicit account approval and MFA before monitoring is enabled.</p>
        <Link href="/">Back to CrediSafe</Link>
      </main>
    );
  }
  return <div className="cc-shell">{children}</div>;
}
