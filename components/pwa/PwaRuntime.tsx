"use client";

import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "credisafe:pwa-install-dismissed";

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    ("standalone" in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((error) => {
          console.warn("CrediSafe service worker registration failed", error);
        });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);
}

export function PwaRuntime() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [online, setOnline] = useState(true);

  useServiceWorker();

  useEffect(() => {
    setOnline(navigator.onLine);

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();

      if (isStandaloneDisplay()) return;
      if (localStorage.getItem(DISMISS_KEY) === "true") return;

      setPromptEvent(event as BeforeInstallPromptEvent);
      window.setTimeout(() => setVisible(true), 1600);
    };

    const handleInstalled = () => {
      setVisible(false);
      setPromptEvent(null);
      localStorage.setItem(DISMISS_KEY, "true");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const canInstall = useMemo(() => Boolean(promptEvent && visible), [promptEvent, visible]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "true");
  };

  const install = async () => {
    if (!promptEvent) return;
    setVisible(false);
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      localStorage.setItem(DISMISS_KEY, "true");
    }
    setPromptEvent(null);
  };

  return (
    <>
      {!online ? (
        <div className="network-banner" role="status" aria-live="polite">
          <span /> CrediSafe is offline. Saved pages may still open, but trips and verification need internet.
        </div>
      ) : null}

      {canInstall ? (
        <aside className="pwa-install-card" aria-label="Install CrediSafe app">
          <button className="pwa-install-close" type="button" onClick={dismiss} aria-label="Dismiss install prompt">
            ×
          </button>
          <div className="pwa-install-icon" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/icon-192.png" alt="" />
          </div>
          <div className="pwa-install-copy">
            <strong>Install CrediSafe</strong>
            <span>Launch dashboard, trips and rewards like a mobile app.</span>
          </div>
          <button className="pwa-install-action" type="button" onClick={install}>
            Install
          </button>
        </aside>
      ) : null}
    </>
  );
}
