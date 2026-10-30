import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/admin";
import { ControlCenter } from "@/components/admin/ControlCenter";

export const metadata: Metadata = {
  title: "Operations Center | CrediSafe",
  robots: { index: false, follow: false },
  description: "Private CrediSafe operations, support and governance console.",
};
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const access = await requireAdmin("overview:read");
  return <ControlCenter role={access.ok ? access.role : "SUPPORT"} />;
}
