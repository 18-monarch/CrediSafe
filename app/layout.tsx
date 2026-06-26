import type { Metadata } from "next";
import "lenis/dist/lenis.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrediSafe — Safe Driving. Real Rewards.",
  description:
    "CrediSafe combines trip intelligence, vehicle verification, safety scoring, XP, rewards and clear driver insights.",
  icons: {
    icon: "/brand/favicon.png",
    shortcut: "/brand/favicon.png",
    apple: "/brand/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
