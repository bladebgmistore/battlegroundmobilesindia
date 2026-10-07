"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FiChevronDown, FiGrid, FiLogOut, FiPackage, FiRefreshCw, FiShield } from "react-icons/fi";
import { useUser, UserButton, SignInButton, SignOutButton } from "@clerk/nextjs";

type User = {
  id: string;
  name: string;
  email: string | null;
  picture: string | null;
  isOwner: boolean;
  role?: string;
  adminAccess?: boolean;
};

/**
 * Header account control — now powered by Clerk.
 * 
 * Uses Clerk's useUser() hook + our /api/auth/session for role info (owner/staff).
 * Falls back to Clerk's UserButton for avatar + sign-out.
 */

export function UserNav() {
  const pathname = usePathname();
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
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
        else if (alive) setUser(null);
      } catch {
        if (alive) setUser(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [pathname, isSignedIn]);

  const close = () => setOpen(false);

  if (!isLoaded || loading) {
    return (
      <span className="grid h-9 w-9 place-items-center rounded-lg border border-[#dbe2ec] text-[#94a3b8]">
        <FiRefreshCw className="animate-spin text-sm" />
      </span>
    );
  }

  if (!isSignedIn || !user) {
    // Clerk handles redirect to sign-in — show sign-in button
    return (
      <div className="hidden items-center gap-2 sm:flex">
        <SignInButton mode="modal">
          <button className="flex items-center gap-2 rounded-xl border border-[#dbe2ec] bg-white px-4 py-2.5 text-xs font-black tracking-[.1em] text-[#0f172a] shadow-sm transition hover:border-[#0f4c81] hover:shadow-md">
            LOGIN
          </button>
        </SignInButton>
        <Link
          href="/sign-in"
          className="flex items-center gap-2 rounded-xl bg-[#0f4c81] px-4 py-2.5 text-xs font-black tracking-[.1em] text-white shadow-sm transition hover:bg-[#0a3557]"
        >
          SIGN IN
        </Link>
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
              {user.role && (
                <span className="mt-1 inline-block rounded bg-[#e0eefb] px-1.5 py-0.5 text-[9px] font-black tracking-[.1em] text-[#0f4c81]">
                  {user.role.toUpperCase()}
                </span>
              )}
            </div>
            <Link href="/dashboard" onClick={close} className="flex items-center gap-3 px-4 py-3 text-sm text-[#334155] hover:bg-[#f1f5fb]">
              <FiGrid className="text-[#0f4c81]" /> My Dashboard
            </Link>
            <Link href="/account" onClick={close} className="flex items-center gap-3 px-4 py-3 text-sm text-[#334155] hover:bg-[#f1f5fb]">
              <FiPackage className="text-[#0f4c81]" /> My Orders
            </Link>
            {(user.adminAccess ?? user.isOwner) && (
              <Link href="/admin" onClick={close} className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-[#0f4c81] hover:bg-[#f1f5fb]">
                <FiShield /> Admin Panel
              </Link>
            )}
            <div className="border-t border-[#eef1f6]">
              <SignOutButton>
                <button className="flex w-full items-center gap-3 px-4 py-3 text-start text-sm text-[#c62828] hover:bg-red-50">
                  <FiLogOut /> Sign Out
                </button>
              </SignOutButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Compact account actions used inside the mobile menu — Clerk powered. */
export function UserMobileAuth() {
  const { isLoaded, isSignedIn } = useUser();
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
  }, [isSignedIn]);

  if (!isLoaded || loading) return null;

  if (!isSignedIn || !user) {
    return (
      <div className="mt-3 grid gap-2 border-t border-[#dbe2ec] pt-4 lg:hidden">
        <Link href="/sign-in" className="btn-primary flex items-center justify-center gap-2 py-3 text-xs font-black tracking-[.12em]">
          LOGIN / SIGN UP
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-3 grid gap-2 border-t border-[#dbe2ec] pt-4 lg:hidden">
      <Link href="/dashboard" className="btn-primary flex items-center justify-center gap-2 py-3 text-xs font-black tracking-[.12em]">MY DASHBOARD</Link>
      <Link href="/account" className="btn-outline flex items-center justify-center gap-2 py-3 text-xs font-black tracking-[.12em]">MY ORDERS</Link>
      {(user.adminAccess ?? user.isOwner) && (
        <Link href="/admin" className="btn-outline flex items-center justify-center gap-2 py-3 text-xs font-black tracking-[.12em]">ADMIN PANEL</Link>
      )}
      <SignOutButton>
        <button className="btn-outline flex w-full items-center justify-center gap-2 py-3 text-xs font-black tracking-[.12em] !text-[#c62828]">SIGN OUT</button>
      </SignOutButton>
    </div>
  );
}
