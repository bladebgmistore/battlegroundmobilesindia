"use client";

import { useCallback, useEffect, useState } from "react";
import { FiAward, FiCheckCircle, FiEdit3, FiGift, FiRefreshCw, FiTrash2, FiUsers, FiXCircle } from "react-icons/fi";
import { StatusChip, formatDateTime, formatPoints, formatSignedPoints } from "@/components/referral-ui";
import type { AdminReferralOverview } from "@/lib/referrals";
import type { AdminRedemption, RedemptionCounts, RewardItem } from "@/lib/rewards";

type Tab = "redemptions" | "referrals" | "commissions" | "items";
type RedemptionFilter = "pending" | "completed" | "rejected" | "all";

type ItemForm = {
  title: string;
  ucAmount: string;
  pointsCost: string;
  badge: string;
  sortOrder: string;
  isActive: boolean;
};

const EMPTY_FORM: ItemForm = { title: "", ucAmount: "", pointsCost: "", badge: "", sortOrder: "100", isActive: true };

const TABS: { id: Tab; label: string; icon: typeof FiGift }[] = [
  { id: "redemptions", label: "Redemptions", icon: FiAward },
  { id: "referrals", label: "Referral tree", icon: FiUsers },
  { id: "commissions", label: "Commission logs", icon: FiGift },
  { id: "items", label: "Store items", icon: FiEdit3 },
];

const FILTERS: RedemptionFilter[] = ["pending", "completed", "rejected", "all"];

const money = (value: number) => `₹${formatPoints(value)}`;

/**
 * Admin → Referrals & Points.
 * Tracks who referred whom, every commission credited (or reversed), the
 * points → UC redemption queue (Pending / Completed / Refunded) and the
 * points store catalogue. Visible to owner, admin and manager.
 */
export default function AdminReferralsPanel() {
  const [tab, setTab] = useState<Tab>("redemptions");
  const [filter, setFilter] = useState<RedemptionFilter>("pending");
  const [overview, setOverview] = useState<AdminReferralOverview | null>(null);
  const [redemptions, setRedemptions] = useState<AdminRedemption[]>([]);
  const [counts, setCounts] = useState<RedemptionCounts | null>(null);
  const [items, setItems] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const flash = (kind: "ok" | "err", text: string) => {
    setNotice({ kind, text });
    setTimeout(() => setNotice(null), 3500);
  };

  const load = useCallback(async () => {
    try {
      const query = filter === "all" ? "" : `?status=${filter}`;
      const [overviewRes, redemptionRes, itemRes] = await Promise.all([
        fetch("/api/admin/referrals", { cache: "no-store", credentials: "same-origin" }),
        fetch(`/api/admin/redemptions${query}`, { cache: "no-store", credentials: "same-origin" }),
        fetch("/api/admin/rewards", { cache: "no-store", credentials: "same-origin" }),
      ]);
      const [overviewBody, redemptionBody, itemBody] = await Promise.all([
        overviewRes.json().catch(() => null),
        redemptionRes.json().catch(() => null),
        itemRes.json().catch(() => null),
      ]);
      if (overviewRes.ok) setOverview(overviewBody as AdminReferralOverview);
      if (redemptionRes.ok) {
        setRedemptions(redemptionBody?.redemptions ?? []);
        setCounts(redemptionBody?.counts ?? null);
      }
      if (itemRes.ok) setItems(itemBody?.items ?? []);
      if (!overviewRes.ok || !redemptionRes.ok) {
        setNotice({ kind: "err", text: overviewBody?.error ?? redemptionBody?.error ?? "Could not load referral data." });
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, status: "completed" | "rejected") => {
    let note: string | null = null;
    if (status === "completed") {
      if (!confirm("Mark this request as completed? Only do this after the UC has been delivered to the player's UID.")) return;
    } else {
      if (!confirm("Reject this request and refund the points to the customer?")) return;
      note = window.prompt("Optional reason shown in the customer's history (leave blank to skip):", "") || null;
    }

    setBusyId(id);
    try {
      const response = await fetch("/api/admin/redemptions", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, note }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) flash("err", data?.error ?? "Could not update this request.");
      else flash("ok", status === "completed" ? "Marked as completed." : "Rejected and points refunded.");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (item: RewardItem) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      ucAmount: String(item.ucAmount),
      pointsCost: String(item.pointsCost),
      badge: item.badge ?? "",
      sortOrder: String(item.sortOrder),
      isActive: item.isActive,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const saveItem = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/rewards", {
        method: editingId ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          title: form.title,
          ucAmount: Number(form.ucAmount),
          pointsCost: Number(form.pointsCost),
          badge: form.badge,
          sortOrder: Number(form.sortOrder) || 0,
          isActive: form.isActive,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        flash("err", data?.error ?? "Could not save this reward.");
        return;
      }
      flash("ok", editingId ? "Reward updated." : "Reward added to the points store.");
      resetForm();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggleItem = async (item: RewardItem) => {
    const response = await fetch("/api/admin/rewards", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) flash("err", data?.error ?? "Could not update this reward.");
    await load();
  };

  const removeItem = async (item: RewardItem) => {
    if (!confirm(`Delete "${item.title}" from the points store? Past redemptions keep their record.`)) return;
    const response = await fetch("/api/admin/rewards", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) flash("err", data?.error ?? "Could not delete this reward.");
    else flash("ok", "Reward deleted.");
    if (editingId === item.id) resetForm();
    await load();
  };

  const stats = overview?.stats;
  const pendingCount = counts?.pending.count ?? 0;

  return (
    <div className="space-y-5">
      {/* ── Headline numbers ─────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Referred users", value: stats?.referredUsers ?? 0, sub: `of ${formatPoints(stats?.totalUsers ?? 0)} accounts`, icon: FiUsers },
          { label: "Active referrers", value: stats?.activeReferrers ?? 0, sub: "earned at least once", icon: FiGift },
          { label: "Points credited", value: formatPoints(stats?.creditedPoints ?? 0), sub: `${money(stats?.referredSales ?? 0)} referred sales`, icon: FiAward },
          { label: "Pending redemptions", value: pendingCount, sub: `${formatPoints(counts?.pending.points ?? 0)} points waiting`, icon: FiRefreshCw },
        ].map(({ label, value, sub, icon: Icon }) => (
          <article key={label} className="rounded-xl border border-[#e5e8ef] bg-white p-5">
            <div className="flex items-start justify-between">
              <p className="text-xs font-bold text-[#64748b]">{label}</p>
              <Icon className="text-[#0f4c81]" />
            </div>
            <p className="mt-3 text-3xl font-black tracking-[-.04em] text-[#0f172a]">{value}</p>
            <p className="mt-1 text-[10px] font-bold tracking-[.08em] text-[#94a3b8]">{sub.toUpperCase()}</p>
          </article>
        ))}
      </div>

      {notice && (
        <div className={`rounded-xl border px-4 py-3 text-xs font-bold ${notice.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {notice.text}
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          const badge = id === "redemptions" ? pendingCount : 0;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[11px] font-black tracking-[.08em] transition ${
                active ? "border-[#0f4c81] bg-[#0f4c81] text-white" : "border-[#dbe2ec] bg-white text-[#334155] hover:border-[#0f4c81]"
              }`}
            >
              <Icon /> {label.toUpperCase()}
              {badge > 0 && (
                <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-white text-[#0f4c81]" : "bg-amber-400 text-[#231a02]"}`}>{badge}</span>
              )}
            </button>
          );
        })}
        <button onClick={() => void load()} className="ml-auto inline-flex items-center gap-1 rounded-xl border border-[#dbe2ec] bg-white px-3 py-2.5 text-[10px] font-black text-[#64748b]">
          <FiRefreshCw className={loading ? "animate-spin" : ""} /> REFRESH
        </button>
      </div>

      {/* ── Redemptions ──────────────────────────────────────────── */}
      {tab === "redemptions" && (
        <section className="overflow-hidden rounded-xl border border-[#e5e8ef] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e8ef] p-5">
            <div>
              <h2 className="font-black text-[#0f172a]">Points → UC redemptions</h2>
              <p className="mt-1 text-xs text-[#64748b]">Deliver the UC to the character ID, then mark it completed. Rejecting refunds the points.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((item) => {
                const count = item === "all" ? (counts ? counts.pending.count + counts.completed.count + counts.rejected.count : 0) : counts?.[item].count ?? 0;
                return (
                  <button
                    key={item}
                    onClick={() => setFilter(item)}
                    className={`rounded-lg border px-3 py-2 text-[10px] font-black tracking-[.1em] ${
                      filter === item ? "border-[#0f4c81] bg-[#e0eefb] text-[#0f4c81]" : "border-[#dbe2ec] text-[#64748b]"
                    }`}
                  >
                    {item.toUpperCase()} · {count}
                  </button>
                );
              })}
            </div>
          </div>

          {redemptions.length === 0 ? (
            <p className="p-9 text-center text-sm text-[#64748b]">{loading ? "Loading…" : "No redemption requests in this view."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1020px] text-left text-sm">
                <thead className="bg-[#f8fafc] text-[9px] font-black tracking-[.13em] text-[#64748b]">
                  <tr>
                    <th className="px-4 py-3">Requested</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Reward</th>
                    <th className="px-4 py-3">Character ID</th>
                    <th className="px-4 py-3 text-right">Points</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Processed</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef1f6]">
                  {redemptions.map((row) => (
                    <tr key={row.id} className="align-top hover:bg-[#f8fafc]">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-[#64748b]">{formatDateTime(row.createdAt)}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-[#0f172a]">{row.userName || "—"}</p>
                        <p className="text-[11px] text-[#64748b]">{row.userEmail}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-[#0f172a]">{formatPoints(row.ucAmount)} UC</p>
                        <p className="text-[11px] text-[#64748b]">{row.rewardTitle}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-bold text-[#0f172a]">{row.playerUid}</p>
                        <p className="text-[11px] text-[#64748b]">{row.playerName ?? "name not verified"}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-[#0f172a]">{formatSignedPoints(row.status === "rejected" ? 0 : -row.pointsCost)}</td>
                      <td className="px-4 py-3">
                        <StatusChip status={row.status} />
                        {row.adminNote && <p className="mt-1 max-w-[180px] text-[10px] text-[#64748b]">{row.adminNote}</p>}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-[#64748b]">
                        {row.processedAt ? (
                          <>
                            <p>{formatDateTime(row.processedAt)}</p>
                            <p className="truncate max-w-[160px]">{row.processedBy}</p>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.status === "pending" ? (
                          <div className="flex justify-end gap-2">
                            <button
                              disabled={busyId === row.id}
                              onClick={() => void act(row.id, "completed")}
                              className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-[#0e9f6e]/40 px-2 py-1.5 text-[9px] font-black text-[#0e9f6e] hover:bg-[#0e9f6e] hover:text-white disabled:opacity-50"
                            >
                              <FiCheckCircle /> COMPLETED
                            </button>
                            <button
                              disabled={busyId === row.id}
                              onClick={() => void act(row.id, "rejected")}
                              className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-red-200 px-2 py-1.5 text-[9px] font-black text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              <FiXCircle /> REJECT &amp; REFUND
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-[#94a3b8]">{row.status === "completed" ? "DONE" : "REFUNDED"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Referral tree ────────────────────────────────────────── */}
      {tab === "referrals" && (
        <section className="overflow-hidden rounded-xl border border-[#e5e8ef] bg-white">
          <div className="border-b border-[#e5e8ef] p-5">
            <h2 className="font-black text-[#0f172a]">Who referred whom</h2>
            <p className="mt-1 text-xs text-[#64748b]">Each row is a signed-up friend and the account that referred them.</p>
          </div>
          {!overview || overview.referrals.length === 0 ? (
            <p className="p-9 text-center text-sm text-[#64748b]">{loading ? "Loading…" : "No referred sign-ups yet."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-[#f8fafc] text-[9px] font-black tracking-[.13em] text-[#64748b]">
                  <tr>
                    <th className="px-4 py-3">Friend (referred)</th>
                    <th className="px-4 py-3">Referred by</th>
                    <th className="px-4 py-3">Referrer code</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3 text-right">Purchases</th>
                    <th className="px-4 py-3 text-right">Points credited</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef1f6]">
                  {overview.referrals.map((row) => (
                    <tr key={row.referredId} className="hover:bg-[#f8fafc]">
                      <td className="px-4 py-3">
                        <p className="font-bold text-[#0f172a]">{row.referredName}</p>
                        <p className="text-[11px] text-[#64748b]">{row.referredEmail}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-[#0f172a]">{row.referrerName}</p>
                        <p className="text-[11px] text-[#64748b]">{row.referrerEmail}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-bold tracking-[.08em] text-[#0f4c81]">{row.referrerCode ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-[#64748b]">{formatDateTime(row.joinedAt)}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#334155]">{row.purchases}</td>
                      <td className="px-4 py-3 text-right font-black text-emerald-700">{formatSignedPoints(row.earnedPoints)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Commission logs ──────────────────────────────────────── */}
      {tab === "commissions" && (
        <section className="overflow-hidden rounded-xl border border-[#e5e8ef] bg-white">
          <div className="border-b border-[#e5e8ef] p-5">
            <h2 className="font-black text-[#0f172a]">Commission logs</h2>
            <p className="mt-1 text-xs text-[#64748b]">
              {overview?.commissions.length ?? 0} entries · credited when an order is confirmed as paid · reversed if it is cancelled or deleted.
            </p>
          </div>
          {!overview || overview.commissions.length === 0 ? (
            <p className="p-9 text-center text-sm text-[#64748b]">{loading ? "Loading…" : "No commissions yet. They appear once a referred friend's order is confirmed."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="bg-[#f8fafc] text-[9px] font-black tracking-[.13em] text-[#64748b]">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Buyer (referred)</th>
                    <th className="px-4 py-3">Referrer</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Rate</th>
                    <th className="px-4 py-3 text-right">Points</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef1f6]">
                  {overview.commissions.map((row) => (
                    <tr key={row.id} className="hover:bg-[#f8fafc]">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-[#64748b]">{formatDateTime(row.createdAt)}</td>
                      <td className="px-4 py-3 font-mono text-xs font-bold text-[#0f172a]">#{row.orderCode}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-[#0f172a]">{row.buyerName || "—"}</p>
                        <p className="text-[11px] text-[#64748b]">{row.buyerEmail}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-[#0f172a]">{row.referrerName || "—"}</p>
                        <p className="text-[11px] text-[#64748b]">{row.referrerEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#334155]">{money(row.purchaseAmount)}</td>
                      <td className="px-4 py-3 text-right text-xs text-[#64748b]">{row.commissionPercent}%</td>
                      <td className={`px-4 py-3 text-right font-black ${row.status === "credited" ? "text-emerald-700" : "text-[#94a3b8] line-through"}`}>
                        {formatSignedPoints(row.points)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip status={row.status} />
                        {row.reversedAt && <p className="mt-1 text-[10px] text-[#64748b]">{formatDateTime(row.reversedAt)}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Store items ──────────────────────────────────────────── */}
      {tab === "items" && (
        <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <section className="h-fit rounded-xl border border-[#e5e8ef] bg-white p-5">
            <h2 className="font-black text-[#0f172a]">{editingId ? "Edit reward" : "Add a reward"}</h2>
            <p className="mt-1 text-xs text-[#64748b]">Customers spend points on these packages in the Points Store.</p>
            <div className="mt-5 space-y-4">
              <label className="block text-[10px] font-black tracking-[.12em] text-[#64748b]">
                TITLE
                <input className="admin-input mt-1" value={form.title} maxLength={180} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. 3800 UC Package" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-[10px] font-black tracking-[.12em] text-[#64748b]">
                  UC AMOUNT
                  <input className="admin-input mt-1" inputMode="numeric" value={form.ucAmount} onChange={(e) => setForm({ ...form, ucAmount: e.target.value.replace(/\D/g, "") })} placeholder="3800" />
                </label>
                <label className="block text-[10px] font-black tracking-[.12em] text-[#64748b]">
                  POINTS COST
                  <input className="admin-input mt-1" inputMode="numeric" value={form.pointsCost} onChange={(e) => setForm({ ...form, pointsCost: e.target.value.replace(/\D/g, "") })} placeholder="2000" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-[10px] font-black tracking-[.12em] text-[#64748b]">
                  BADGE (OPTIONAL)
                  <input className="admin-input mt-1" value={form.badge} maxLength={48} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder="POPULAR" />
                </label>
                <label className="block text-[10px] font-black tracking-[.12em] text-[#64748b]">
                  SORT ORDER
                  <input className="admin-input mt-1" inputMode="numeric" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value.replace(/[^\d-]/g, "") })} />
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-[#334155]">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Visible to customers
              </label>
              <div className="flex gap-2 pt-1">
                <button onClick={() => void saveItem()} disabled={saving} className="admin-primary flex-1 disabled:opacity-60">
                  {saving ? "SAVING…" : editingId ? "SAVE CHANGES" : "ADD REWARD"}
                </button>
                {editingId && (
                  <button onClick={resetForm} className="rounded-xl border border-[#dbe2ec] px-4 py-3 text-[10px] font-black text-[#64748b]">CANCEL</button>
                )}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-[#e5e8ef] bg-white">
            <div className="border-b border-[#e5e8ef] p-5">
              <h2 className="font-black text-[#0f172a]">Points store catalogue</h2>
              <p className="mt-1 text-xs text-[#64748b]">{items.length} rewards · {items.filter((i) => i.isActive).length} visible to customers</p>
            </div>
            {items.length === 0 ? (
              <p className="p-9 text-center text-sm text-[#64748b]">{loading ? "Loading…" : "No rewards yet. Add the first one on the left."}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-[#f8fafc] text-[9px] font-black tracking-[.13em] text-[#64748b]">
                    <tr>
                      <th className="px-4 py-3">Reward</th>
                      <th className="px-4 py-3 text-right">UC</th>
                      <th className="px-4 py-3 text-right">Points</th>
                      <th className="px-4 py-3">Visible</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef1f6]">
                    {items.map((item) => (
                      <tr key={item.id} className={`hover:bg-[#f8fafc] ${editingId === item.id ? "bg-[#f0f7ff]" : ""}`}>
                        <td className="px-4 py-3">
                          <p className="font-bold text-[#0f172a]">{item.title}</p>
                          <p className="text-[10px] text-[#64748b]">{item.badge ?? "no badge"} · sort {item.sortOrder}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-[#334155]">{formatPoints(item.ucAmount)}</td>
                        <td className="px-4 py-3 text-right font-black text-[#0f172a]">{formatPoints(item.pointsCost)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => void toggleItem(item)} className={`rounded-md border px-2 py-1 text-[9px] font-black ${item.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[#dbe2ec] bg-[#f1f5fb] text-[#64748b]"}`}>
                            {item.isActive ? "VISIBLE" : "HIDDEN"}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => startEdit(item)} className="inline-flex items-center gap-1 rounded border border-[#dbe2ec] px-2 py-1 text-[9px] font-black text-[#64748b]"><FiEdit3 /> EDIT</button>
                            <button onClick={() => void removeItem(item)} className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-[9px] font-black text-red-600"><FiTrash2 /> DELETE</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
