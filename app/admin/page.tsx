import type { Metadata } from "next";
import { OperationsCenter } from "@/components/admin/OperationsCenter";

export const metadata: Metadata = {
  title: "Operations Center | CrediSafe",
  robots: { index: false, follow: false },
  description: "Private CrediSafe platform operations and governance console.",
};

export default function AdminPage() {
  return <OperationsCenter />;
}
