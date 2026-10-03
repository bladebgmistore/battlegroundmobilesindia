"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Fires a lightweight page-view beacon on every route change.
 *
 * The server (/api/track) attaches the authenticated email (or "Guest" for
 * signed-out homepage visitors), the real client IP and the timestamp — the
 * browser only supplies the path, so the log cannot be forged by a visitor.
 */
function Beacon() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastLogged = useRef<string>("");

  useEffect(() => {
    if (!pathname) return;
    // Never log the login screen or the OAuth round-trip.
    if (pathname.startsWith("/login") || pathname.startsWith("/auth/")) return;

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
