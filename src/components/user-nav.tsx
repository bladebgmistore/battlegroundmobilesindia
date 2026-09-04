"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FiChevronDown, FiLogOut, FiRefreshCw, FiUser, FiPackage } from "react-icons/fi";

type User = { id: string; name: string; email: string | null; whatsapp: string | null };

/**
 * Header control for authenticated customers: shows a "Sign in" button when
 * logged out, or an account menu when logged in. Fetches the session once.
 */
export function UserNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
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

  const logout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      // ignore
    }
    setUser(null);
    setOpen(false);
    setLoggingOut(false);
    router.replace("/login");
  };

  if (loading) {
    return (
      <span className="grid h-9 w-9 place-items-center rounded-lg border border-[#dbe2ec] text-[#94a3b8]">
        <FiRefreshCw className="animate-spin text-sm" />
      </span>
    );
  }

  if (!user) {
    return (
      <div className="hidden items-center gap-2 sm:flex">
        <Link href="/login" className="btn-outline px-4 py-2 text-xs font-black tracking-[.1em]">SIGN IN</Link>
        <Link href="/signup" className="btn-primary px-4 py-2 text-xs font-black tracking-[.1em]">SIGN UP</Link>
      </div>
    );
  }

  return (
    <div className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-[#dbe2ec] bg-white px-3 py-2 text-xs font-bold text-[#334155] transition hover:border-[#0f4c81] hover:text-[#0f4c81]"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-[#0f4c81] text-[10px] font-black text-white">{user.name.slice(0, 1).toUpperCase()}</span>
        <span className="max-w-[10rem] truncate">{user.name.split(" ")[0]}</span>
        <FiChevronDown />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={close} />
          <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-[#e3e9f2] bg-white shadow-xl">
            <div className="border-b border-[#eef1f6] px-4 py-3">
              <p className="text-sm font-extrabold text-[#0f172a]">{user.name}</p>
              <p className="mt-0.5 truncate text-xs text-[#64748b]">{user.email ?? user.whatsapp}</p>
            </div>
            <Link href="/account" onClick={close} className="flex items-center gap-3 px-4 py-3 text-sm text-[#334155] hover:bg-[#f1f5fb]">
              <FiPackage className="text-[#0f4c81]" /> My Orders
            </Link>
            <Link href="/account" onClick={close} className="flex items-center gap-3 px-4 py-3 text-sm text-[#334155] hover:bg-[#f1f5fb]">
              <FiUser className="text-[#0f4c81]" /> Profile & Security
            </Link>
            <button onClick={logout} disabled={loggingOut} className="flex w-full items-center gap-3 border-t border-[#eef1f6] px-4 py-3 text-start text-sm text-[#c62828] hover:bg-red-50">
              <FiLogOut />{loggingOut ? "Signing out…" : "Sign Out"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Compact login action used inside the mobile menu. */
export function UserMobileAuth() {
  return (
    <div className="mt-3 grid gap-2 border-t border-[#dbe2ec] pt-4 lg:hidden">
      <Link href="/login" className="btn-outline flex items-center justify-center gap-2 py-3 text-xs font-black tracking-[.12em]">SIGN IN</Link>
      <Link href="/account" className="btn-primary flex items-center justify-center gap-2 py-3 text-xs font-black tracking-[.12em]">MY ACCOUNT</Link>
    </div>
  );
}
