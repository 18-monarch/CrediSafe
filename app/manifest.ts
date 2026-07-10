import type { MetadataRoute } from "next";

const screenshots = [
  {
    src: "/brand/pwa-screenshot-mobile.png",
    sizes: "720x910",
    type: "image/png",
    form_factor: "narrow",
    label: "CrediSafe mobile home screen"
  },
  {
    src: "/brand/pwa-screenshot-wide.png",
    sizes: "1280x720",
    type: "image/png",
    form_factor: "wide",
    label: "CrediSafe cinematic desktop experience"
  }
];

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "CrediSafe — Safe Driving Rewards",
    short_name: "CrediSafe",
    description:
      "CrediSafe turns responsible journeys into transparent safety scores, XP and reward progress.",
    start_url: "/app/dashboard?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#06130f",
    theme_color: "#22c55e",
    categories: ["navigation", "utilities", "productivity", "finance"],
    icons: [
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/brand/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/brand/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ],
    shortcuts: [
      {
        name: "Start trip",
        short_name: "Trip",
        description: "Start a CrediSafe journey.",
        url: "/app/trip?source=pwa-shortcut",
        icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }]
      },
      {
        name: "Dashboard",
        short_name: "Dashboard",
        description: "View your safety score, XP and rewards.",
        url: "/app/dashboard?source=pwa-shortcut",
        icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }]
      },
      {
        name: "Video verification",
        short_name: "Vision",
        description: "Upload driving evidence for vehicle intelligence.",
        url: "/app/vision?source=pwa-shortcut",
        icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }]
      },
      {
        name: "Rewards",
        short_name: "Rewards",
        description: "Review reward progress and claimable benefits.",
        url: "/app/rewards?source=pwa-shortcut",
        icons: [{ src: "/brand/icon-192.png", sizes: "192x192" }]
      }
    ],
    screenshots
  } as MetadataRoute.Manifest;
}
