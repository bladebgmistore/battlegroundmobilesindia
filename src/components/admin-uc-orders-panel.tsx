"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiClock, FiDownload, FiEye, FiMapPin, FiPackage, FiRefreshCw, FiSearch, FiUser, FiX, FiZap } from "react-icons/fi";
import { formatINR } from "@/lib/store-data";

type UcOrder = {
  id: string;
  orderCode: string;
  customerName: string;
  customerWhatsapp: string;
  playerUid?: string | null;
  playerName?: string | null;
  productName: string;
  amount: number;
  originalAmount?: number;
  discountAmount?: number;
  couponCode?: string | null;
  status: string;
  paymentScreenshot?: string | null;
  transactionRef?: string | null;
  buyerIp?: string | null;
  buyerCity?: string | null;
  buyerRegion?: string | null;
  buyerCountry?: string | null;
  paidAt?: string | null;
  createdAt: string;
};

const STATUSES = ["awaiting_contact", "payment_review", "payment_confirmed", "delivered", "cancelled"];

const STATUS_STYLE: Record<string, string> = {
  awaiting_contact: "border-amber-200 bg-amber-50 text-amber-700",
  payment_review: "border-sky-200 bg-sky-50 text-sky-700",
  payment_confirmed: "border-violet-200 bg-violet-50 text-violet-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-red-200 bg-red-50 text-red-600",
};

const label = (status: string) => status.replaceAll("_", " ").toUpperCase();

/**
 * Admin → UC Orders.
 *
 * UC purchases are hidden from the buyer's "My Orders" page, so this desk is
 * the single source of truth for them: Player ID, character name, transaction
 * ID / payment receipt, amount and delivery status.
 */
export default function AdminUcOrdersPanel({
  onToast,
  onChanged,
}: {
  onToast?: (message: string) => void;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<UcOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [preview, setPreview] = useState<UcOrder | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/uc-orders", { cache: "no-store", credentials: "same-origin" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.orders) {
        setRows(data.orders as UcOrder[]);
        setOffline(Boolean(data.databaseOffline));
      }
    } catch {
      // next poll retries
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const kick = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 8000);
    return () => { clearTimeout(kick); clearInterval(timer); };
  }, [load]);

  const setStatus = async (order: UcOrder, status: string) => {
    setBusyId(order.id);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, status }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        onToast?.(data?.error ?? "Could not update the UC order.");
        return;
      }
      setRows((current) => current.map((row) => (row.id === order.id ? { ...row, status } : row)));
      onToast?.(`UC order ${order.orderCode} → ${label(status)}`);
      onChanged?.();
    } catch {
      onToast?.("Network error while updating the UC order.");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!needle) return true;
      return [row.orderCode, row.customerName, row.customerWhatsapp, row.playerUid, row.playerName, row.transactionRef, row.productName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [rows, query, statusFilter]);

  const stats = useMemo(() => ({
    total: rows.length,
    review: rows.filter((row) => row.status === "payment_review" || row.status === "awaiting_contact").length,
    delivered: rows.filter((row) => row.status === "delivered").length,
    revenue: rows.filter((row) => row.status === "delivered").reduce((sum, row) => sum + row.amount, 0),
  }), [rows]);

  const when = (value?: string | null) =>
    value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "UC orders", value: stats.total, copy: "All time", tint: "from-[#0f4c81] to-[#1b6fb0]" },
          { label: "Awaiting payment", value: stats.review, copy: "New / in review", tint: "from-[#f59e0b] to-[#fbbf24]" },
          { label: "Delivered", value: stats.delivered, copy: "UC credited", tint: "from-[#0e9f6e] to-[#34d399]" },
          { label: "Delivered value", value: formatINR(stats.revenue), copy: "Confirmed revenue", tint: "from-[#7c3aed] to-[#a855f7]" },
        ].map((card) => (
          <article key={card.label} className="rounded-2xl border border-[#e5e8ef] bg-white p-5">
            <p className="text-xs font-bold text-[#64748b]">{card.label}</p>
            <p className="mt-3 text-2xl font-black tracking-[-.04em] text-[#0f172a]">{card.value}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[9px] font-black tracking-[.11em] text-[#0f4c81]">
              <span className={`h-1.5 w-1.5 rounded-full bg-gradient-to-br ${card.tint}`} /> {card.copy.toUpperCase()}
            </p>
          </article>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-[#e5e8ef] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e8ef] p-5">
          <div>
            <h2 className="font-black text-[#0f172a]">UC Orders</h2>
            <p className="mt-1 text-xs text-[#64748b]">
              Player ID, character name, transaction ID &amp; receipt for every UC purchase{offline ? " (demo store)" : ""}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search UID, UTR, buyer…"
                className="admin-input !h-9 !w-56 !pl-9 text-xs"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="admin-input !h-9 !w-40 text-[10px]"
            >
              <option value="all">ALL STATUSES</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>{label(status)}</option>
              ))}
            </select>
            <span className="rounded bg-[#f1f5fb] px-2 py-1 text-[10px] font-bold text-[#64748b]">{filtered.length} ORDERS</span>
            <button onClick={() => void load()} className="grid h-9 w-9 place-items-center rounded-lg border border-[#dbe2ec] text-[#64748b] transition hover:text-[#0f4c81]" title="Refresh">
              <FiRefreshCw className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] text-left">
              <thead className="bg-[#f8fafc] text-[9px] font-black tracking-[.13em] text-[#64748b]">
                <tr>
                  <th className="p-4">REFERENCE</th>
                  <th className="p-4">BUYER</th>
                  <th className="p-4">PLAYER ID / CHARACTER</th>
                  <th className="p-4">PACKAGE</th>
                  <th className="p-4">TRANSACTION ID / RECEIPT</th>
                  <th className="p-4">AMOUNT</th>
                  <th className="p-4">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e8ef]">
                {filtered.map((order) => (
                  <tr key={order.id} className="align-top text-xs transition hover:bg-[#f8fafc]">
                    <td className="p-4">
                      <p className="font-mono font-black text-[#0f4c81]">{order.orderCode}</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#64748b]"><FiClock /> {when(order.createdAt)}</p>
                      {order.paidAt && <p className="mt-1 text-[10px] font-bold text-[#0e9f6e]">Paid: {when(order.paidAt)}</p>}
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-[#0f172a]">{order.customerName}</p>
                      <p className="mt-1 font-mono text-[11px] text-[#64748b]">{order.customerWhatsapp}</p>
                      {order.buyerIp && (
                        <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#94a3b8]">
                          <FiMapPin className="text-[#0f4c81]" />
                          {[order.buyerCity, order.buyerRegion, order.buyerCountry].filter(Boolean).join(", ") || order.buyerIp}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      {order.playerUid ? (
                        <>
                          <span className="rounded bg-[#e0eefb] px-2 py-1 font-mono font-black text-[#0f4c81]">{order.playerUid}</span>
                          <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-black text-[#0e9f6e]">
                            <FiUser /> {order.playerName || "Character name unavailable"}
                          </p>
                        </>
                      ) : (
                        <span className="text-[#94a3b8]">—</span>
                      )}
                    </td>
                    <td className="max-w-[210px] p-4 text-[#334155]">{order.productName}</td>
                    <td className="p-4">
                      {order.transactionRef ? (
                        <p className="font-mono font-black text-[#0f172a]">{order.transactionRef}</p>
                      ) : (
                        <p className="text-[10px] font-bold text-amber-600">NOT SUBMITTED</p>
                      )}
                      {order.paymentScreenshot ? (
                        <button
                          onClick={() => setPreview(order)}
                          className="group relative mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#dbe2ec] px-2 py-1 text-[9px] font-black text-[#0f4c81] transition hover:bg-[#f1f5fb]"
                        >
                          <FiEye /> VIEW RECEIPT
                        </button>
                      ) : (
                        <p className="mt-1 text-[9px] font-black text-[#94a3b8]">NO RECEIPT</p>
                      )}
                    </td>
                    <td className="p-4">
                      <p className="font-black text-[#0f172a]">{formatINR(order.amount)}</p>
                      {order.couponCode && <p className="mt-1 text-[10px] text-[#0f4c81]">Coupon {order.couponCode}</p>}
                    </td>
                    <td className="p-4">
                      <span className={`inline-block rounded-full border px-2.5 py-1 text-[9px] font-black ${STATUS_STYLE[order.status] ?? "border-[#dbe2ec] bg-[#f8fafc] text-[#64748b]"}`}>
                        {label(order.status)}
                      </span>
                      <select
                        value={order.status}
                        disabled={busyId === order.id}
                        onChange={(event) => void setStatus(order, event.target.value)}
                        className="admin-input mt-2 !h-9 !w-44 text-[10px] disabled:opacity-50"
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>{label(status)}</option>
                        ))}
                      </select>
                      {order.status !== "delivered" && (
                        <button
                          onClick={() => void setStatus(order, "delivered")}
                          disabled={busyId === order.id}
                          className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded border border-[#0e9f6e]/40 px-2 py-1 text-[9px] font-black text-[#0e9f6e] transition hover:bg-[#0e9f6e] hover:text-white disabled:opacity-50"
                        >
                          <FiZap /> MARK UC DELIVERED
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e0eefb] text-2xl text-[#0f4c81]"><FiPackage /></span>
            <p className="mt-4 text-sm font-black text-[#0f172a]">
              {loading ? "Loading UC orders…" : rows.length ? "No UC orders match this filter." : "No UC orders yet."}
            </p>
            <p className="mt-1 text-xs text-[#64748b]">Every UC purchase from the storefront appears here — never in the buyer&apos;s order history.</p>
          </div>
        )}
      </section>

      {preview?.paymentScreenshot && (
        <div className="modal-overlay fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div onClick={(event) => event.stopPropagation()} className="modal-card w-full max-w-2xl overflow-hidden rounded-2xl border border-[#dbe2ec] bg-white shadow-[0_30px_80px_rgba(15,40,70,.35)]">
            <div className="flex items-center justify-between border-b border-[#e5e8ef] px-5 py-4">
              <div>
                <p className="text-[10px] font-black tracking-[.14em] text-[#0f4c81]">UC PAYMENT RECEIPT</p>
                <p className="mt-0.5 font-mono text-sm font-black text-[#0f172a]">{preview.orderCode} · {formatINR(preview.amount)}</p>
              </div>
              <div className="flex items-center gap-2">
                <a href={preview.paymentScreenshot} download={`uc-payment-${preview.orderCode}.jpg`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#dbe2ec] px-3 py-2 text-[10px] font-black text-[#0f4c81] transition hover:bg-[#f1f5fb]">
                  <FiDownload /> DOWNLOAD
                </a>
                <button onClick={() => setPreview(null)} aria-label="Close preview" className="grid h-9 w-9 place-items-center rounded-lg border border-[#dbe2ec] text-[#64748b] transition hover:bg-[#f1f5fb] hover:text-[#0f172a]">
                  <FiX />
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto bg-[#f8fafc] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.paymentScreenshot} alt={`UC payment proof ${preview.orderCode}`} className="mx-auto max-h-[64vh] rounded-xl border border-[#e5e8ef] object-contain" />
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-[#e5e8ef] px-5 py-3 text-[11px] text-[#64748b]">
              <span><b className="text-[#0f172a]">{preview.customerName}</b> · {preview.customerWhatsapp}</span>
              {preview.playerUid && <span>UID: <b className="font-mono text-[#0f4c81]">{preview.playerUid}</b>{preview.playerName ? ` (${preview.playerName})` : ""}</span>}
              {preview.transactionRef && <span>UTR: <b className="font-mono text-[#0f172a]">{preview.transactionRef}</b></span>}
              <span className="inline-flex items-center gap-1 text-[#0e9f6e]"><FiCheckCircle /> {label(preview.status)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
