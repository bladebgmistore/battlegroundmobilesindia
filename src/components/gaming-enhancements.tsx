"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

type AosApi = {
  init: (options?: Record<string, unknown>) => void;
  refresh?: () => void;
  refreshHard?: () => void;
};

declare global {
  interface Window {
    AOS?: AosApi;
  }
}

function refreshAos() {
  const aos = typeof window !== "undefined" ? window.AOS : undefined;
  if (!aos) return;
  if (aos.refreshHard) aos.refreshHard();
  else aos.refresh?.();
}

function initialiseAos() {
  if (typeof window === "undefined" || !window.AOS) return;

  window.AOS.init({
    duration: 850,
    easing: "ease-out-cubic",
    offset: 72,
    once: true,
    mirror: false,
    anchorPlacement: "top-bottom",
    disable: () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
  refreshAos();
}

export function GamingEnhancements() {
  const pathname = usePathname();

  useEffect(() => {
    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      if (window.AOS) {
        initialiseAos();
        window.clearInterval(interval);
      }
      if (attempts > 25) window.clearInterval(interval);
    }, 200);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(refreshAos, 250);
    return () => window.clearTimeout(timeout);
  }, [pathname]);

  useEffect(() => {
    if (typeof MutationObserver === "undefined") return undefined;

    let refreshTimer: number | undefined;
    const observer = new MutationObserver(() => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(refreshAos, 180);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.clearTimeout(refreshTimer);
    };
  }, []);

  return (
    <Script
      id="aos-cdn"
      src="https://unpkg.com/aos@2.3.4/dist/aos.js"
      strategy="afterInteractive"
      onReady={initialiseAos}
    />
  );
}
