import type { Metadata } from "next";
import { ControlCenter } from "@/components/admin/ControlCenter";
export const metadata: Metadata = {
  title: "Team Control Center | CrediSafe",
  robots: { index: false, follow: false },
  description: "Private, authenticated CrediSafe operations dashboard.",
};
export default function AdminPage() {
  return <ControlCenter />;
}
