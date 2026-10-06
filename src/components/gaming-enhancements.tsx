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

  document.documentElement.classList.add("aos-ready");
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
    document.documentElement.classList.add("reveal-ready");

    const revealNow = (element: Element) => element.classList.add("reveal-visible");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let observer: IntersectionObserver | null = null;
    if (!reducedMotion) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            revealNow(entry.target);
            observer?.unobserve(entry.target);
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
      );
    }

    const observe = () => {
      document.querySelectorAll<HTMLElement>("[data-aos]:not(.reveal-visible)").forEach((element) => {
        if (reducedMotion) revealNow(element);
        else observer?.observe(element);
      });
    };

    observe();
    const initialTimer = window.setTimeout(observe, 350);
    let mutationTimer: number | undefined;
    const mutationObserver = new MutationObserver(() => {
      window.clearTimeout(mutationTimer);
      mutationTimer = window.setTimeout(observe, 80);
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(initialTimer);
      window.clearTimeout(mutationTimer);
      mutationObserver.disconnect();
      observer?.disconnect();
    };
  }, [pathname]);

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
