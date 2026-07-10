import type { Metadata } from "next";
import "lenis/dist/lenis.css";
import "./globals.css";
import { PwaRuntime } from "@/components/pwa/PwaRuntime";

export const metadata: Metadata = {
  title: "CrediSafe - Safe Driving. Real Rewards.",
  description:
    "CrediSafe combines trip intelligence, vehicle verification, safety scoring, XP, rewards and clear driver insights.",
  manifest: "/manifest.webmanifest",
  applicationName: "CrediSafe",
  appleWebApp: {
    capable: true,
    title: "CrediSafe",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/brand/favicon.png" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/brand/favicon.png",
    apple: "/brand/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaRuntime />
      </body>
    </html>
  );
}

