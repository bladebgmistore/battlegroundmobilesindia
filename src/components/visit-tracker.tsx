"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Fires a lightweight page-view beacon on every route change.
 *
 * The server (/api/track) attaches the Clerk authenticated email, real client IP
 * and timestamp — the browser only supplies the path, so the log cannot be forged.
 * Logs to site_logs table: email, IP, URL, timestamp for admin panel.
 */
function Beacon() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastLogged = useRef<string>("");

  useEffect(() => {
    if (!pathname) return;
    // Never log the auth screens or OAuth round-trip.
    if (
      pathname.startsWith("/sign-in") ||
      pathname.startsWith("/sign-up") ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/auth/")
    )
      return;

    const query = searchParams?.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    if (lastLogged.current === url) return;
    lastLogged.current = url;

    const payload = JSON.stringify({ path: url, referrer: document.referrer || null });

    // keepalive lets the request survive a fast navigation away.
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname, searchParams]);

  return null;
}

export default function VisitTracker() {
  return <Beacon />;
}
