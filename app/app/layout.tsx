import type { ReactNode } from "react";
import { AppShell } from "@/components/mvp/AppShell";
import "./mvp.css";

export default function ProductLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
