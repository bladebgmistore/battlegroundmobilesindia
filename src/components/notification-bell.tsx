"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiBell, FiCheck, FiCheckCircle, FiMessageSquare, FiPackage, FiRadio } from "react-icons/fi";

export type UserNotification = {
  id: string;
  type: "order_update" | "support_reply" | "announcement" | string;
  badge: string | null;
  title: string;
  body: string | null;
  link: string | null;
  orderId: string | null;
  ticketId: string | null;
  createdAt: string;
  isRead: boolean;
};

const TYPE_META: Record<string, { label: string; className: string; icon: typeof FiBell }> = {
  order_update: { label: "ORDER", className: "bg-[#e0eefb] text-[#0f4c81]", icon: FiPackage },
  support_reply: { label: "SUPPORT", className: "bg-[#dcf5e8] text-[#0e9f6e]", icon: FiMessageSquare },
  announcement: { label: "NEWS", className: "bg-[#fdf1d1] text-[#8a6d00]", icon: FiRadio },
};

const BADGE_META: Record<string, string> = {
  "General": "bg-[#f1f5fb] text-[#64748b]",
  "Offer": "bg-[#fde8f4] text-[#be185d]",
  "Urgent Maintenance": "bg-[#fde8e8] text-[#c62828]",
  "Update": "bg-[#e0e7ff] text-[#4338ca]",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * Header notification bell — the user Notification Center.
 *
 * Shows a red unread badge, and a dropdown with order status updates, unread
 * support chat alerts and admin announcements. "Mark all as read" clears the
 * badge; clicking a notification jumps to the related order / chat page.
 * Polls every 8s so new alerts appear live. Hidden for signed-out visitors.
 */
export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Lightweight badge poll.
  const pollCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?count=1", { cache: "no-store", credentials: "same-origin" });
      if (res.status === 401) {
        setSignedIn(false);
        return;
      }
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setSignedIn(true);
        setUnreadCount(Number(data.unreadCount ?? 0));
      }
    } catch {
      // offline — keep the last known state
    }
  }, []);

  // Full list when the dropdown opens.
  const loadAll = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store", credentials: "same-origin" });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setNotifications(data.notifications ?? []);
        setUnreadCount(Number(data.unreadCount ?? 0));
        setLoaded(true);
      }
    } catch {
      // keep stale list
    }
  }, []);

  useEffect(() => {
    const kick = setTimeout(() => void pollCount(), 0);
    const timer = setInterval(() => void pollCount(), 8000);
    return () => { clearTimeout(kick); clearInterval(timer); };
  }, [pollCount, pathname]);

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void loadAll();
  };

  const markRead = async (ids: string[]) => {
    if (!ids.length) return;
    setNotifications((current) => current.map((n) => (ids.includes(n.id) ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - ids.length));
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) setUnreadCount(Number(data.unreadCount ?? 0));
    } catch {
      // optimistic update stands
    }
  };

  const markAllRead = async () => {
    setNotifications((current) => current.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) setUnreadCount(Number(data.unreadCount ?? 0));
    } catch {
      // optimistic update stands
    }
  };

  const openNotification = (n: UserNotification) => {
    setOpen(false);
    void markRead([n.id]);
    if (n.link) router.push(n.link);
  };

  // Signed-out visitors never see the bell (notifications are user-specific).
  if (signedIn === false) return null;
  if (signedIn === null) {
    return (
      <span className="grid h-9 w-9 place-items-center rounded-lg border border-[#dbe2ec] text-[#cbd5e1]" aria-hidden>
        <FiBell />
      </span>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-[#dbe2ec] bg-white text-[#334155] transition hover:border-[#0f4c81] hover:text-[#0f4c81]"
      >
        <FiBell />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid min-w-[17px] h-[17px] place-items-center rounded-full bg-[#e11d48] px-1 text-[9px] font-black text-white shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-xl border border-[#e3e9f2] bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-[#eef1f6] px-4 py-3">
            <p className="text-sm font-extrabold text-[#0f172a]">Notifications</p>
            {unreadCount > 0 ? (
              <button type="button" onClick={() => void markAllRead()} className="inline-flex items-center gap-1 text-[10px] font-black tracking-[.08em] text-[#0f4c81] hover:underline">
                <FiCheckCircle /> MARK ALL AS READ
              </button>
            ) : (
              <span className="text-[10px] font-bold text-[#94a3b8]">ALL CAUGHT UP</span>
            )}
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {!loaded ? (
              <p className="p-6 text-center text-xs font-bold text-[#94a3b8]">Loading…</p>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <FiBell className="mx-auto text-2xl text-[#cbd5e1]" />
                <p className="mt-2 text-xs font-bold text-[#64748b]">No notifications yet</p>
                <p className="mt-1 text-[10px] text-[#94a3b8]">Order updates, support replies and announcements appear here.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const meta = TYPE_META[n.type] ?? { label: "INFO", className: "bg-[#f1f5fb] text-[#64748b]", icon: FiBell };
                const Icon = meta.icon;
                const chip = n.type === "announcement" && n.badge ? BADGE_META[n.badge] ?? BADGE_META.General : meta.className;
                const label = n.type === "announcement" && n.badge ? n.badge.toUpperCase() : meta.label;
                const inner = (
                  <div className={`flex gap-3 px-4 py-3 transition hover:bg-[#f8fafc] ${n.isRead ? "" : "bg-[#f3f8fe]"}`}>
                    <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${meta.className.replace(/bg-\[[^\]]+\]\s*/, "bg-[#eef1f6] ")} text-[#0f4c81]`}>
                      <Icon className="text-sm" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded px-1.5 py-0.5 text-[8px] font-black tracking-[.1em] ${chip}`}>{label}</span>
                        {!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-[#e11d48]" aria-label="unread" />}
                        <span className="ml-auto text-[9px] font-bold text-[#94a3b8]">{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-xs font-extrabold text-[#0f172a]">{n.title}</p>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-[#64748b]">{n.body}</p>}
                    </div>
                  </div>
                );
                return n.link ? (
                  <button key={n.id} type="button" onClick={() => openNotification(n)} className="block w-full text-left">{inner}</button>
                ) : (
                  <div key={n.id} onClick={() => void markRead([n.id])} role="button" tabIndex={0} className="cursor-pointer">{inner}</div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t border-[#eef1f6] px-4 py-2.5">
            <span className="text-[10px] font-bold text-[#94a3b8]">
              {unreadCount > 0 ? `${unreadCount} unread` : "Inbox zero ✨"}
            </span>
            <Link href="/account" onClick={() => setOpen(false)} className="inline-flex items-center gap-1 text-[10px] font-black tracking-[.08em] text-[#0f4c81] hover:underline">
              <FiCheck /> MY ORDERS
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
