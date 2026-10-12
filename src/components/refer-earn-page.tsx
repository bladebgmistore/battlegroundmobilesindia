"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FiArrowRight, FiAward, FiGift, FiLink, FiRefreshCw, FiShoppingBag, FiUsers } from "react-icons/fi";
import { GridBackdrop, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { ReferralLinkBox } from "@/components/referral-link-box";
import { StatusChip, formatDateTime, formatPoints, formatSignedPoints } from "@/components/referral-ui";
import type { ReferralDashboard } from "@/lib/referrals";

type DashboardResponse = ReferralDashboard & { ok: true };

const STEPS = [
  {
    icon: FiLink,
    title: "Share your link",
    copy: "Copy your referral link or share it on WhatsApp. Anyone who signs up through it is linked to you.",
  },
  {
    icon: FiShoppingBag,
    title: "They buy, you earn",
    copy: "When a referred friend's order is confirmed, 20% of the amount they paid is credited to you as points.",
  },
  {
    icon: FiAward,
    title: "Redeem for UC",
    copy: "Spend your points in the Points Store to get UC delivered to your BGMI character ID.",
  },
];

/** Refer & Earn dashboard: referral link, totals, referred friends and points history. */
export default function ReferEarnPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/referrals", { cache: "no-store", credentials: "same-origin" });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) {
        setError(body?.error ?? "Could not load your referral dashboard.");
        return;
      }
      setData(body as DashboardResponse);
      setError("");
    } catch {
      setError("Network error. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred like the other admin panels, so the first fetch never runs inside the effect body.
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  const refresh = () => {
    setLoading(true);
    void load();
  };

  const stats = data?.stats;
  const pct = stats?.commissionPercent ?? 20;

  return (
    <>
      <GridBackdrop />
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-12 lg:px-8 lg:py-16">
        {/* ── Hero: link + call to action ─────────────────────────── */}
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f4c81] via-[#1b6fb0] to-[#0a3557] p-7 text-white shadow-lg lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div>
              <p className="text-[10px] font-black tracking-[.22em] text-[#ffd76a]">REFER &amp; EARN</p>
              <h1 className="mt-3 text-3xl font-black tracking-[-.04em] sm:text-4xl">Invite friends. Earn {pct}% in points.</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/85">
                Every purchase your friends confirm earns you {pct}% of the amount they paid, credited automatically as points.
                Spend points on UC in the Points Store.
              </p>
              <Link
                href="/rewards"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-xs font-black tracking-[.12em] text-[#0f4c81] transition hover:bg-[#e0eefb]"
              >
                REDEEM IN POINTS STORE <FiArrowRight />
              </Link>
            </div>

            <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur">
              <p className="text-[10px] font-black tracking-[.18em] text-white/70">YOUR REFERRAL LINK</p>
              {data?.referralCode ? (
                <div className="mt-3 space-y-4">
                  <ReferralLinkBox code={data.referralCode} variant="dark" />
                  <p className="text-xs text-white/75">
                    Your code: <span className="font-black tracking-[.15em] text-white">{data.referralCode}</span>
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-white/80">{loading ? "Loading your link…" : error || "Your link is not available yet."}</p>
              )}
            </div>
          </div>
        </section>

        {error && data === null && !loading && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
            <span>{error}</span>
            <button onClick={refresh} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-1.5 text-[10px] font-black">
              <FiRefreshCw /> TRY AGAIN
            </button>
          </div>
        )}

        {/* ── Totals ───────────────────────────────────────────────── */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total referrals", value: stats?.totalReferrals ?? 0, sub: "friends who signed up", icon: FiUsers },
            { label: "Friends who bought", value: stats?.purchasingReferrals ?? 0, sub: "with a confirmed order", icon: FiShoppingBag },
            { label: "Points earned", value: stats?.totalEarnedPoints ?? 0, sub: "lifetime commission", icon: FiGift },
            { label: "Available points", value: stats?.availablePoints ?? 0, sub: `${formatPoints(stats?.redeemedPoints ?? 0)} redeemed so far`, icon: FiAward },
          ].map(({ label, value, sub, icon: Icon }) => (
            <article key={label} className="rounded-2xl border border-[#e3e9f2] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#64748b]">{label}</p>
                <Icon className="text-lg text-[#0f4c81]" />
              </div>
              <p className="mt-4 text-3xl font-black tracking-[-.04em] text-[#0f172a]">{formatPoints(value)}</p>
              <p className="mt-1 text-[11px] font-semibold text-[#64748b]">{sub}</p>
            </article>
          ))}
        </section>

        {/* ── How it works ─────────────────────────────────────────── */}
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, copy }, index) => (
            <article key={title} className="rounded-2xl border border-[#e3e9f2] bg-white p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e0eefb] text-[#0f4c81]">
                  <Icon />
                </span>
                <span className="text-[10px] font-black tracking-[.18em] text-[#94a3b8]">STEP {index + 1}</span>
              </div>
              <p className="mt-4 text-sm font-black text-[#0f172a]">{title}</p>
              <p className="mt-2 text-xs leading-5 text-[#64748b]">{copy}</p>
            </article>
          ))}
        </section>

        {/* ── Referred friends ─────────────────────────────────────── */}
        <section className="mt-8 overflow-hidden rounded-2xl border border-[#e3e9f2] bg-white">
          <div className="flex items-center justify-between border-b border-[#eef1f6] p-5">
            <h2 className="flex items-center gap-2 font-black text-[#0f172a]">
              <FiUsers className="text-[#0f4c81]" /> Your referrals
            </h2>
            <span className="text-[10px] font-bold text-[#64748b]">{data?.referrals.length ?? 0} SHOWN</span>
          </div>
          {!data || data.referrals.length === 0 ? (
            <p className="p-8 text-center text-sm text-[#64748b]">
              {loading ? "Loading…" : "No referrals yet. Share your link to invite your first friend."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-[#f8fafc] text-[10px] font-black uppercase tracking-[.1em] text-[#64748b]">
                  <tr>
                    <th className="px-5 py-3">Friend</th>
                    <th className="px-5 py-3">Joined</th>
                    <th className="px-5 py-3">Purchases</th>
                    <th className="px-5 py-3 text-right">Points earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef1f6]">
                  {data.referrals.map((friend) => (
                    <tr key={friend.id} className="hover:bg-[#f8fafc]">
                      <td className="px-5 py-3">
                        <p className="font-bold text-[#0f172a]">{friend.name}</p>
                        <p className="text-xs text-[#64748b]">{friend.maskedEmail}</p>
                      </td>
                      <td className="px-5 py-3 text-xs text-[#64748b]">{formatDateTime(friend.joinedAt)}</td>
                      <td className="px-5 py-3 text-xs font-bold text-[#334155]">{friend.purchases}</td>
                      <td className="px-5 py-3 text-right font-black text-emerald-700">{formatSignedPoints(friend.earnedPoints)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Points history ───────────────────────────────────────── */}
        <section className="mt-8 overflow-hidden rounded-2xl border border-[#e3e9f2] bg-white">
          <div className="flex items-center justify-between border-b border-[#eef1f6] p-5">
            <h2 className="flex items-center gap-2 font-black text-[#0f172a]">
              <FiAward className="text-[#0f4c81]" /> Points history
            </h2>
            <button onClick={refresh} className="inline-flex items-center gap-1 text-[10px] font-black tracking-[.12em] text-[#0f4c81]">
              <FiRefreshCw className={loading ? "animate-spin" : ""} /> REFRESH
            </button>
          </div>
          {!data || data.history.length === 0 ? (
            <p className="p-8 text-center text-sm text-[#64748b]">
              {loading ? "Loading…" : "No points activity yet. Commissions and redemptions will appear here."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-[#f8fafc] text-[10px] font-black uppercase tracking-[.1em] text-[#64748b]">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Activity</th>
                    <th className="px-5 py-3">Details</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef1f6]">
                  {data.history.map((item) => (
                    <tr key={`${item.kind}-${item.id}`} className="hover:bg-[#f8fafc]">
                      <td className="whitespace-nowrap px-5 py-3 text-xs text-[#64748b]">{formatDateTime(item.createdAt)}</td>
                      <td className="px-5 py-3 font-bold text-[#0f172a]">{item.title}</td>
                      <td className="px-5 py-3 text-xs text-[#64748b]">{item.detail}</td>
                      <td className="px-5 py-3"><StatusChip status={item.status} /></td>
                      <td
                        className={`px-5 py-3 text-right font-black ${
                          item.points > 0 ? "text-emerald-700" : item.points < 0 ? "text-[#0f172a]" : "text-[#94a3b8] line-through"
                        }`}
                      >
                        {formatSignedPoints(item.points)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-8 text-center text-[11px] leading-5 text-[#94a3b8]">
          Commission is credited when an order is confirmed as paid. If the order is cancelled, its commission is reversed.
          Points are not cash and are redeemed only through the Points Store.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
