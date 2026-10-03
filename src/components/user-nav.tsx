"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FiChevronDown, FiGrid, FiLogOut, FiPackage, FiRefreshCw, FiShield } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";

type User = { id: string; name: string; email: string | null; picture: string | null; isOwner: boolean };

/**
 * Header account control.
 *
 * The homepage is public, so signed-out visitors see a "Login with Google"
 * button here; every other page redirects to /login first.
 */
export function UserNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (alive && data?.authenticated && data.user) setUser(data.user as User);
      } catch {
        // treat as logged out
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [pathname]);

  const close = () => setOpen(false);

  if (loading) {
    return (
      <span className="grid h-9 w-9 place-items-center rounded-lg border border-[#dbe2ec] text-[#94a3b8]">
        <FiRefreshCw className="animate-spin text-sm" />
      </span>
    );
  }

  if (!user) {
    // Signed-out visitor on the public homepage.
    return (
      <div className="hidden items-center gap-2 sm:flex">
        <a
          href="/auth/google?next=/dashboard"
          className="flex items-center gap-2 rounded-xl border border-[#dbe2ec] bg-white px-4 py-2.5 text-xs font-black tracking-[.1em] text-[#0f172a] shadow-sm transition hover:border-[#0f4c81] hover:shadow-md"
        >
          <FcGoogle className="text-base" /> LOGIN
        </a>
      </div>
    );
  }

  const initial = user.name?.[0]?.toUpperCase() ?? "U";

  return (
    <div className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-[#dbe2ec] bg-white px-3 py-2 text-xs font-bold text-[#334155] transition hover:border-[#0f4c81] hover:text-[#0f4c81]"
      >
        {user.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.picture} alt="" referrerPolicy="no-referrer" className="h-6 w-6 rounded-full" />
        ) : (
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[#0f4c81] text-[10px] font-black text-white">{initial}</span>
        )}
        <span className="max-w-[10rem] truncate">{user.name.split(" ")[0]}</span>
        <FiChevronDown />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={close} />
          <div className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-xl border border-[#e3e9f2] bg-white shadow-xl">
            <div className="border-b border-[#eef1f6] px-4 py-3">
              <p className="text-sm font-extrabold text-[#0f172a]">{user.name}</p>
              <p className="mt-0.5 truncate text-xs text-[#64748b]">{user.email}</p>
            </div>
            <Link href="/dashboard" onClick={close} className="flex items-center gap-3 px-4 py-3 text-sm text-[#334155] hover:bg-[#f1f5fb]">
              <FiGrid className="text-[#0f4c81]" /> My Dashboard
            </Link>
            <Link href="/account" onClick={close} className="flex items-center gap-3 px-4 py-3 text-sm text-[#334155] hover:bg-[#f1f5fb]">
              <FiPackage className="text-[#0f4c81]" /> My Orders
            </Link>
            {user.isOwner && (
              <Link href="/admin" onClick={close} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-[#0f4c81] hover:bg-[#f1f5fb]">
                <FiShield /> Admin Panel
              </Link>
            )}
            <a href="/auth/logout" className="flex w-full items-center gap-3 border-t border-[#eef1f6] px-4 py-3 text-start text-sm text-[#c62828] hover:bg-red-50">
              <FiLogOut /> Sign Out
            </a>
          </div>
        </>
      )}
    </div>
  );
}

/** Compact account actions used inside the mobile menu. */
export function UserMobileAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (alive && data?.authenticated && data.user) setUser(data.user as User);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return null;

  if (!user) {
    return (
      <div className="mt-3 grid gap-2 border-t border-[#dbe2ec] pt-4 lg:hidden">
        <a href="/auth/google?next=/dashboard" className="btn-primary flex items-center justify-center gap-2 py-3 text-xs font-black tracking-[.12em]">
          <FcGoogle className="text-base" /> LOGIN WITH GOOGLE
        </a>
      </div>
    );
  }

  return (
    <div className="mt-3 grid gap-2 border-t border-[#dbe2ec] pt-4 lg:hidden">
      <Link href="/dashboard" className="btn-primary flex items-center justify-center gap-2 py-3 text-xs font-black tracking-[.12em]">MY DASHBOARD</Link>
      <Link href="/account" className="btn-outline flex items-center justify-center gap-2 py-3 text-xs font-black tracking-[.12em]">MY ORDERS</Link>
      {user.isOwner && (
        <Link href="/admin" className="btn-outline flex items-center justify-center gap-2 py-3 text-xs font-black tracking-[.12em]">ADMIN PANEL</Link>
      )}
      <a href="/auth/logout" className="btn-outline flex items-center justify-center gap-2 py-3 text-xs font-black tracking-[.12em] !text-[#c62828]">SIGN OUT</a>
    </div>
  );
}
