"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  FiArrowRight,
  FiCheckCircle,
  FiGrid,
  FiLogOut,
  FiMail,
  FiPackage,
  FiShield,
  FiShoppingBag,
  FiUser,
} from "react-icons/fi";
import { GridBackdrop, SiteHeader } from "@/components/site-chrome";
import { SignOutButton } from "@clerk/nextjs";

export type DashboardUser = {
  name: string;
  email: string;
  picture: string | null;
  role: string;
  isOwner: boolean;
  /** owner / admin / manager / moderator → can open /admin. */
  adminAccess?: boolean;
};

type Order = { id: string; orderCode: string; productName: string; amount: number; status: string; createdAt: string };

const QUICK_LINKS = [
  { href: "/", label: "Browse store", copy: "Accounts, UC packs, X-Suits and super cars.", icon: FiShoppingBag },
  { href: "/accounts", label: "BGMI accounts", copy: "Verified accounts ready for instant delivery.", icon: FiGrid },
  { href: "/uc-purchase", label: "Buy UC", copy: "Top up Unknown Cash at the best price.", icon: FiPackage },
  { href: "/account", label: "My orders", copy: "Track every order and download invoices.", icon: FiPackage },
];

export default function UserDashboard({ user, forbidden }: { user: DashboardUser; forbidden?: boolean }) {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetch("/api/account/orders", { cache: "no-store", credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setOrders(data?.orders?.slice(0, 5) ?? []))
      .catch(() => undefined);
  }, []);

  return (
    <>
      <GridBackdrop />
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-12 lg:px-8 lg:py-16">
        {forbidden && (
          <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
            That area is restricted to the store owner.
          </p>
        )}

        {/* ── Profile card ─────────────────────────────────────────── */}
        <section className="premium-card flex flex-wrap items-center gap-6 rounded-2xl border border-[#e3e9f2] bg-white p-7">
          {user.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.picture}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="h-20 w-20 rounded-full border-2 border-[#e0eefb] object-cover"
            />
          ) : (
            <span className="grid h-20 w-20 place-items-center rounded-full bg-[#e0eefb] text-2xl font-black text-[#0f4c81]">
              {user.name?.[0]?.toUpperCase() ?? "U"}
            </span>
          )}

          <div className="min-w-[200px] flex-1">
            <p className="text-[11px] font-bold tracking-[.22em] text-[#0f4c81]">MY DASHBOARD</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-.04em] text-[#0f172a]">{user.name}</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-[#64748b]">
              <FiMail className="text-[#0f4c81]" /> {user.email}
            </p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#ecfdf5] px-3 py-1.5 text-[11px] font-black text-emerald-700">
              <FiCheckCircle /> SIGNED IN WITH CLERK · {user.role.toUpperCase()}
            </p>
            {user.isOwner && (
              <p className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#0f4c81] px-3 py-1.5 text-[10px] font-black tracking-[.1em] text-white">
                <FiShield /> OWNER ACCESS · {user.email}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {(user.adminAccess ?? user.isOwner) && (
              <Link
                href="/admin"
                className="btn-primary flex items-center justify-center gap-2 px-5 py-3 text-xs font-black tracking-[.12em]"
              >
                <FiShield /> OPEN ADMIN PANEL
              </Link>
            )}
            <SignOutButton>
              <button className="btn-outline flex items-center justify-center gap-2 px-5 py-3 text-xs font-black tracking-[.12em]">
                <FiLogOut /> SIGN OUT
              </button>
            </SignOutButton>
          </div>
        </section>

        {/* ── Staff banner (owner / admin / manager / moderator) ──── */}
        {(user.adminAccess ?? user.isOwner) && (
          <section className="mt-6 rounded-2xl border border-[#0f4c81]/20 bg-[#0f4c81] p-6 text-white">
            <p className="text-[10px] font-black tracking-[.2em] text-white/70">
              {user.role === "owner" ? "OWNER ACCESS" : `STAFF ACCESS · ${user.role.toUpperCase()}`}
            </p>
            <h2 className="mt-2 text-xl font-black">
              {user.role === "owner" ? "You are signed in as the store owner" : `You are on the store team as ${user.role}`}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              The admin panel gives you catalog management, order processing, site controls and the live visitor
              tracking log — every page view with user email, IP address and timestamp.
              {user.email === "manavjeph800@gmail.com" && " You are the primary owner (manavjeph800@gmail.com)."}
            </p>
            <Link
              href="/admin"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-xs font-black tracking-[.12em] text-[#0f4c81]"
            >
              GO TO ADMIN <FiArrowRight />
            </Link>
          </section>
        )}

        {/* ── Quick links ──────────────────────────────────────────── */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_LINKS.map(({ href, label, copy, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-2xl border border-[#e3e9f2] bg-white p-5 transition hover:border-[#0f4c81] hover:shadow-lg"
            >
              <Icon className="text-xl text-[#0f4c81]" />
              <p className="mt-3 text-sm font-black text-[#0f172a]">{label}</p>
              <p className="mt-1 text-xs leading-5 text-[#64748b]">{copy}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-black tracking-[.12em] text-[#0f4c81]">
                OPEN <FiArrowRight className="transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </section>

        {/* ── Recent orders ────────────────────────────────────────── */}
        <section className="mt-8 overflow-hidden rounded-2xl border border-[#e3e9f2] bg-white">
          <div className="flex items-center justify-between border-b border-[#eef1f6] p-5">
            <h2 className="flex items-center gap-2 font-black text-[#0f172a]">
              <FiUser className="text-[#0f4c81]" /> Recent orders
            </h2>
            <Link href="/account" className="text-[10px] font-black tracking-[.12em] text-[#0f4c81]">
              VIEW ALL
            </Link>
          </div>
          {orders.length === 0 ? (
            <p className="p-8 text-center text-sm text-[#64748b]">
              No orders yet — browse the store to place your first order.
            </p>
          ) : (
            <div className="divide-y divide-[#eef1f6]">
              {orders.map((order) => (
                <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-bold text-[#0f172a]">{order.productName}</p>
                    <p className="mt-0.5 text-xs text-[#64748b]">
                      #{order.orderCode} · {new Date(order.createdAt).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-[#0f172a]">₹{order.amount}</p>
                    <p className="text-[10px] font-black tracking-[.1em] text-[#0f4c81]">
                      {order.status.replace(/_/g, " ").toUpperCase()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
