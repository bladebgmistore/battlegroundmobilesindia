"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FaBolt } from "react-icons/fa";
import { FiArrowRight, FiCheckCircle, FiLoader, FiRefreshCw, FiX } from "react-icons/fi";
import { GridBackdrop, PageTitle, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { StatusChip, formatDateTime, formatPoints, formatSignedPoints } from "@/components/referral-ui";
import type { RewardItem, Redemption } from "@/lib/rewards";

const UID_PATTERN = /^\d{8,12}$/;

type VerifyState = "idle" | "checking" | "verified" | "soft" | "error";

/** Points store: spend referral points on UC packages. Every redemption opens a pending request for the team. */
export default function RewardsPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [items, setItems] = useState<RewardItem[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<RewardItem | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/rewards", { cache: "no-store", credentials: "same-origin" });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) {
        setError(body?.error ?? "Could not load the points store.");
        return;
      }
      setBalance(Number(body.balance) || 0);
      setItems(body.items ?? []);
      setRedemptions(body.redemptions ?? []);
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

  const finishRedemption = (newBalance: number, message: string) => {
    setBalance(newBalance);
    setNotice(message);
    setSelected(null);
    void load();
  };

  return (
    <>
      <GridBackdrop />
      <SiteHeader />
      <main>
        <PageTitle
          eyebrow="POINTS STORE"
          title="Redeem points for UC"
          copy="Turn your referral points into UC. Pick a package, enter your BGMI character ID and our team delivers the UC to that account."
        />

        <section className="mx-auto max-w-7xl px-5 pb-20 lg:px-8">
          {/* ── Balance ──────────────────────────────────────────── */}
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="premium-card flex flex-wrap items-center gap-6 rounded-2xl border border-[#e3e9f2] bg-white p-6">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#fdf1d1] text-2xl text-[#b7791f]">
                <FaBolt />
              </span>
              <div>
                <p className="text-[10px] font-black tracking-[.18em] text-[#64748b]">AVAILABLE POINTS</p>
                <p className="mt-1 text-4xl font-black tracking-[-.05em] text-[#0f172a]">
                  {balance === null ? "—" : formatPoints(balance)}
                </p>
              </div>
              <p className="max-w-md text-xs leading-5 text-[#64748b]">
                Points come from your referrals: 20% of each confirmed purchase. Points are not cash and cannot be withdrawn.
              </p>
            </div>
            <Link href="/refer-earn" className="btn-outline justify-center px-5 py-4 text-xs font-black tracking-[.12em]">
              EARN MORE POINTS <FiArrowRight />
            </Link>
          </div>

          {notice && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
              <FiCheckCircle className="mt-0.5 shrink-0 text-base" />
              <span className="flex-1">{notice}</span>
              <button onClick={() => setNotice("")} aria-label="Dismiss" className="text-emerald-700"><FiX /></button>
            </div>
          )}
          {error && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
              <span>{error}</span>
              <button onClick={refresh} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-1.5 text-[10px] font-black">
                <FiRefreshCw /> TRY AGAIN
              </button>
            </div>
          )}

          {/* ── Store items ──────────────────────────────────────── */}
          <div className="mt-10">
            {loading && items.length === 0 ? (
              <div className="grid place-items-center py-20"><div className="spinner" /></div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#c7d2e0] bg-white/60 py-20 text-center">
                <p className="text-lg font-black text-[#0f172a]">No rewards are live right now.</p>
                <p className="mt-2 text-sm text-[#64748b]">Check back soon — new UC packages are added regularly.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => {
                  const canAfford = balance !== null && balance >= item.pointsCost;
                  const missing = Math.max(0, item.pointsCost - (balance ?? 0));
                  return (
                    <article key={item.id} className="premium-card gaming-card group p-6">
                      <div className="flex items-start justify-between">
                        <span className="rounded bg-[#e0eefb] px-2 py-1 text-[9px] font-bold tracking-[.12em] text-[#0f4c81]">
                          {item.badge ?? "UC REWARD"}
                        </span>
                        <FaBolt className="text-2xl text-[#f4b400]" />
                      </div>
                      <div className="mt-6">
                        <p className="text-4xl font-black tracking-[-.06em] text-[#0f172a]">
                          {formatPoints(item.ucAmount)} <span className="text-lg text-[#0f4c81]">UC</span>
                        </p>
                        <p className="mt-1 text-xs font-bold text-[#64748b]">{item.title}</p>
                      </div>
                      <div className="mt-7 flex items-center justify-between gap-3 border-t border-[#e5e8ef] pt-5">
                        <p>
                          <span className="text-xl font-black text-[#0f172a]">{formatPoints(item.pointsCost)}</span>{" "}
                          <span className="text-xs font-bold text-[#64748b]">points</span>
                        </p>
                        {canAfford ? (
                          <button onClick={() => setSelected(item)} className="btn-primary !py-2.5 !px-4 text-[11px]">
                            REDEEM <FiArrowRight />
                          </button>
                        ) : (
                          <span className="rounded-lg bg-[#f1f5fb] px-3 py-2 text-[10px] font-black tracking-[.1em] text-[#64748b]">
                            NEED {formatPoints(missing)} MORE
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── My redemptions ───────────────────────────────────── */}
          <section className="mt-12 overflow-hidden rounded-2xl border border-[#e3e9f2] bg-white">
            <div className="flex items-center justify-between border-b border-[#eef1f6] p-5">
              <h2 className="font-black text-[#0f172a]">My redemptions</h2>
              <span className="text-[10px] font-bold text-[#64748b]">{redemptions.length} REQUESTS</span>
            </div>
            {redemptions.length === 0 ? (
              <p className="p-8 text-center text-sm text-[#64748b]">
                {loading ? "Loading…" : "No redemptions yet. Your UC requests will show up here with their status."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-[#f8fafc] text-[10px] font-black uppercase tracking-[.1em] text-[#64748b]">
                    <tr>
                      <th className="px-5 py-3">Requested</th>
                      <th className="px-5 py-3">Reward</th>
                      <th className="px-5 py-3">Character ID</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef1f6]">
                    {redemptions.map((row) => (
                      <tr key={row.id} className="hover:bg-[#f8fafc]">
                        <td className="whitespace-nowrap px-5 py-3 text-xs text-[#64748b]">{formatDateTime(row.createdAt)}</td>
                        <td className="px-5 py-3 font-bold text-[#0f172a]">{row.ucAmount.toLocaleString("en-IN")} UC</td>
                        <td className="px-5 py-3 text-xs font-semibold text-[#334155]">{row.playerUid}{row.playerName ? ` · ${row.playerName}` : ""}</td>
                        <td className="px-5 py-3"><StatusChip status={row.status} /></td>
                        <td className="px-5 py-3 text-right font-black text-[#0f172a]">
                          {formatSignedPoints(row.status === "rejected" ? 0 : -row.pointsCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      </main>
      <SiteFooter />

      {selected && balance !== null && (
        <RedeemDialog
          item={selected}
          balance={balance}
          onClose={() => setSelected(null)}
          onDone={finishRedemption}
        />
      )}
    </>
  );
}

function RedeemDialog({
  item,
  balance,
  onClose,
  onDone,
}: {
  item: RewardItem;
  balance: number;
  onClose: () => void;
  onDone: (newBalance: number, message: string) => void;
}) {
  const [uid, setUid] = useState("");
  const [verify, setVerify] = useState<VerifyState>("idle");
  const [playerName, setPlayerName] = useState("");
  const [verifyMessage, setVerifyMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  // Looks up the in-game name for the UID (same service the checkout uses). Lookup is
  // advisory: when the service is busy the UID format alone is accepted.
  const lookup = useCallback(async (value: string) => {
    const current = ++requestId.current;
    setVerify("checking");
    setPlayerName("");
    setVerifyMessage("");
    try {
      const response = await fetch(`/api/bgmi/verify-uid?uid=${encodeURIComponent(value)}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (current !== requestId.current) return;
      if (data?.verified && data.playerName) {
        setVerify("verified");
        setPlayerName(String(data.playerName));
      } else if (response.ok && data && !data.verified && /busy|continue/i.test(String(data.error ?? ""))) {
        setVerify("soft");
        setVerifyMessage(String(data.error));
      } else {
        setVerify("error");
        setVerifyMessage(String(data?.error ?? "Could not verify this UID. Please re-check it."));
      }
    } catch {
      if (current !== requestId.current) return;
      setVerify("soft");
      setVerifyMessage("Verification service unreachable — your UID format looks valid, you can continue.");
    }
  }, []);

  const onUidChange = (value: string) => {
    const clean = value.replace(/\D/g, "").slice(0, 12);
    setUid(clean);
    setFormError("");
    if (timer.current) clearTimeout(timer.current);
    requestId.current += 1; // invalidate any in-flight lookup
    if (!UID_PATTERN.test(clean)) {
      setVerify("idle");
      setPlayerName("");
      setVerifyMessage("");
      return;
    }
    timer.current = setTimeout(() => void lookup(clean), 500);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const submit = async () => {
    if (!UID_PATTERN.test(uid)) {
      setFormError("Enter a valid BGMI character ID (8-12 digits).");
      return;
    }
    if (verify === "error") {
      setFormError("This character ID could not be verified. Please check it before redeeming.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const response = await fetch("/api/rewards/redeem", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, playerUid: uid, playerName: playerName || null }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        setFormError(String(data?.error ?? "Could not complete this redemption. Please try again."));
        return;
      }
      onDone(
        typeof data.balance === "number" ? data.balance : balance - item.pointsCost,
        `${formatPoints(item.ucAmount)} UC requested for character ID ${uid}. ${formatPoints(item.pointsCost)} points were used — the status updates below.`,
      );
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const remaining = balance - item.pointsCost;

  return (
    <div className="modal-overlay fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="redeem-title"
        onClick={(event) => event.stopPropagation()}
        className="modal-card w-full max-w-md rounded-2xl border border-[#dbe2ec] bg-white p-6 shadow-[0_30px_80px_rgba(15,40,70,.3)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black tracking-[.18em] text-[#0f4c81]">CONFIRM REDEMPTION</p>
            <h2 id="redeem-title" className="mt-1 text-xl font-black text-[#0f172a]">
              {formatPoints(item.ucAmount)} UC · {formatPoints(item.pointsCost)} points
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-[#64748b]"><FiX /></button>
        </div>

        <div className="mt-5 rounded-xl border border-[#e5e8ef] bg-[#f8fafc] p-4 text-xs leading-5 text-[#334155]">
          <div className="flex justify-between"><span>Points now</span><b>{formatPoints(balance)}</b></div>
          <div className="flex justify-between"><span>Points spent</span><b>−{formatPoints(item.pointsCost)}</b></div>
          <div className="mt-2 flex justify-between border-t border-[#e5e8ef] pt-2"><span>Points left</span><b>{formatPoints(remaining)}</b></div>
        </div>

        <label className="mt-5 block text-[10px] font-black tracking-[.14em] text-[#64748b]" htmlFor="redeem-uid">
          BGMI CHARACTER ID (UID)
        </label>
        <input
          id="redeem-uid"
          inputMode="numeric"
          autoComplete="off"
          value={uid}
          onChange={(event) => onUidChange(event.target.value)}
          placeholder="e.g. 5123456789"
          className="form-input mt-2"
        />
        <p className="mt-2 min-h-[1.25rem] text-xs font-semibold">
          {verify === "checking" && <span className="inline-flex items-center gap-1 text-[#64748b]"><FiLoader className="animate-spin" /> Checking UID…</span>}
          {verify === "verified" && <span className="text-emerald-700">Player found: {playerName}</span>}
          {(verify === "soft" || verify === "error") && <span className={verify === "error" ? "text-red-600" : "text-amber-700"}>{verifyMessage}</span>}
        </p>

        {formError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{formError}</p>}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button onClick={onClose} className="btn-outline flex-1 justify-center py-3 text-xs font-black tracking-[.12em]">CANCEL</button>
          <button
            onClick={submit}
            disabled={submitting || verify === "checking"}
            className="btn-primary flex-[1.4] justify-center py-3 text-xs font-black tracking-[.12em] disabled:opacity-60"
          >
            {submitting ? <FiLoader className="animate-spin" /> : null} {submitting ? "REDEEMING…" : "CONFIRM & REDEEM"}
          </button>
        </div>
        <p className="mt-4 text-center text-[11px] leading-5 text-[#94a3b8]">
          Points are deducted now. UC is delivered manually to this character ID by our team.
        </p>
      </div>
    </div>
  );
}
