"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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

const salesNotifications = [
  "🔥 Aman from Delhi just purchased a Max Level Account 2 mins ago!",
  "⚡ Priya from Mumbai just booked a 6,600 UC Pack 5 mins ago!",
  "🎮 Rohit from Jaipur just grabbed a Glacier M416 Account 3 mins ago!",
  "✨ Sneha from Bengaluru just ordered an X-Suit Bundle 4 mins ago!",
  "🏆 Arjun from Hyderabad just purchased a Super Car Skin 7 mins ago!",
];

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
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(false);

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

  useEffect(() => {
    let revealTimer: number | undefined;
    const initialTimer = window.setTimeout(() => setVisible(true), 1600);
    const interval = window.setInterval(() => {
      setVisible(false);
      window.clearTimeout(revealTimer);
      revealTimer = window.setTimeout(() => {
        setActiveIndex((current) => (current + 1) % salesNotifications.length);
        setVisible(true);
      }, 650);
    }, 7600);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearTimeout(revealTimer);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <>
      <Script
        id="aos-cdn"
        src="https://unpkg.com/aos@2.3.4/dist/aos.js"
        strategy="afterInteractive"
        onReady={initialiseAos}
      />
      <div
        className={`live-sales-popup ${visible ? "is-visible" : ""}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="live-sales-pulse" aria-hidden />
        <div className="live-sales-icon" aria-hidden>
          🔥
        </div>
        <div>
          <p className="live-sales-label">Live player activity</p>
          <p className="live-sales-text">{salesNotifications[activeIndex]}</p>
        </div>
      </div>
    </>
  );
}
