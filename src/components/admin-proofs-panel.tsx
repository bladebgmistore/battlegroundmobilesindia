"use client";

import { useCallback, useEffect, useState } from "react";
import { FiCheckCircle, FiEdit3, FiPlus, FiRefreshCw, FiShuffle, FiTrash2, FiEye, FiEyeOff } from "react-icons/fi";
import { ImageInput } from "@/components/image-input";
import { formatINR } from "@/lib/store-data";
import { generateOrderCode, PLACEHOLDER_PROOF_IMAGE, type Proof } from "@/lib/proof-shared";

type ProofForm = {
  customerName: string;
  orderCode: string;
  productTitle: string;
  amount: string;
  deliveredAt: string;
  proofImage: string;
  isActive: boolean;
};

const EMPTY_FORM: ProofForm = {
  customerName: "",
  orderCode: "",
  productTitle: "",
  amount: "",
  deliveredAt: "",
  proofImage: "",
  isActive: true,
};



const toDateInput = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const deliveredLabel = (iso: string | null) => {
  if (!iso) return "Date not set";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date not set";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

function PanelHeader({ icon: Icon, title, copy }: { icon: typeof FiPlus; title: string; copy: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[#0f4c81]">
        <Icon />
        <p className="text-[10px] font-black tracking-[.14em]">MANAGEMENT</p>
      </div>
      <h2 className="mt-3 text-xl font-black text-[#0f172a]">{title}</h2>
      <p className="mt-2 text-xs leading-5 text-[#64748b]">{copy}</p>
    </div>
  );
}

function Action({ onClick, label, icon: Icon, danger = false }: { onClick: () => void; label: string; icon: typeof FiPlus; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`grid h-8 w-8 place-items-center rounded-lg border text-sm transition ${
        danger
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-[#dbe2ec] text-[#64748b] hover:border-[#0f4c81] hover:text-[#0f4c81]"
      }`}
    >
      <Icon />
    </button>
  );
}

/**
 * Admin → Customer Proofs.
 *
 * Publishes verified order deliveries to the public /proofs page: customer
 * name, order id (auto #ORD-xxxx when left blank), product title, amount (₹),
 * delivery date and the proof image / invoice (uploaded screenshots are
 * compressed in the browser before they are stored). New proofs appear on
 * the live site immediately. Visible to owner, admin and manager.
 */
export default function AdminProofsPanel() {
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProofForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const flash = (kind: "ok" | "err", text: string) => {
    setNotice({ kind, text });
    setTimeout(() => setNotice(null), 3500);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/proofs", { cache: "no-store", credentials: "same-origin" });
      const body = await res.json().catch(() => null);
      // On failure the previous (last good) list stays on screen.
      if (res.ok) setProofs(Array.isArray(body?.proofs) ? body.proofs : []);
      else flash("err", body?.error ?? "Could not load proofs.");
    } catch {
      flash("err", "Network error while loading proofs.");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await load();
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        customerName: form.customerName,
        productTitle: form.productTitle,
        amount: Number(form.amount),
        proofImage: form.proofImage,
        isActive: form.isActive,
        deliveredAt: form.deliveredAt || undefined,
      };
      if (form.orderCode.trim()) payload.orderCode = form.orderCode;

      const res = await fetch("/api/admin/proofs", {
        method: editingId ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        flash("err", body?.error ?? "Could not save this proof.");
        return;
      }
      flash("ok", editingId ? "Proof updated — live on the website." : "Proof published — live on the website.");
      resetForm();
      await load();
    } catch {
      flash("err", "Network error while saving.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this proof permanently?")) return;
    try {
      const res = await fetch("/api/admin/proofs", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        flash("err", body?.error ?? "Could not delete this proof.");
        return;
      }
      flash("ok", "Proof deleted.");
      if (editingId === id) resetForm();
      await load();
    } catch {
      flash("err", "Network error while deleting.");
    }
  };

  const toggleActive = async (proof: Proof) => {
    try {
      const res = await fetch("/api/admin/proofs", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proof.id, isActive: !proof.isActive }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        flash("err", body?.error ?? "Could not update visibility.");
        return;
      }
      await load();
    } catch {
      flash("err", "Network error while updating.");
    }
  };

  const startEdit = (proof: Proof) => {
    setEditingId(proof.id);
    setForm({
      customerName: proof.customerName,
      orderCode: proof.orderCode,
      productTitle: proof.productTitle,
      amount: String(proof.amount),
      deliveredAt: toDateInput(proof.deliveredAt),
      proofImage: proof.proofImage ?? "",
      isActive: proof.isActive,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
      {/* Add / edit form */}
      <section className="h-fit rounded-xl border border-[#e5e8ef] bg-white p-5">
        <PanelHeader
          icon={editingId ? FiEdit3 : FiPlus}
          title={editingId ? "Edit Customer Proof" : "Add Customer Proof"}
          copy="Publishes a verified delivery to /proofs immediately. Leave the Order ID blank to auto-generate a random #ORD-xxxx."
        />
        <div className="mt-5 grid gap-3">
          <label className="grid gap-2 text-[10px] font-black tracking-wide text-[#64748b]">
            CUSTOMER NAME
            <input
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              placeholder="e.g. Rahul Sharma"
              className="admin-input"
            />
          </label>
          <label className="grid gap-2 text-[10px] font-black tracking-wide text-[#64748b]">
            ORDER ID <span className="font-normal normal-case tracking-normal text-[#94a3b8]">(blank = auto #ORD-xxxx)</span>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                value={form.orderCode}
                onChange={(e) => setForm({ ...form, orderCode: e.target.value })}
                placeholder="#ORD-4127"
                className="admin-input font-mono"
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, orderCode: generateOrderCode() })}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#dbe2ec] bg-white px-3 text-[10px] font-black text-[#0f4c81] hover:bg-[#f1f5fb]"
              >
                <FiShuffle /> RANDOM
              </button>
            </div>
          </label>
          <label className="grid gap-2 text-[10px] font-black tracking-wide text-[#64748b]">
            PRODUCT TITLE
            <input
              value={form.productTitle}
              onChange={(e) => setForm({ ...form, productTitle: e.target.value })}
              placeholder="Exact product title the customer bought"
              className="admin-input"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-[10px] font-black tracking-wide text-[#64748b]">
              AMOUNT (₹)
              <input
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                type="number"
                min={1}
                placeholder="e.g. 1299"
                className="admin-input"
              />
            </label>
            <label className="grid gap-2 text-[10px] font-black tracking-wide text-[#64748b]">
              DELIVERED ON
              <input
                value={form.deliveredAt}
                onChange={(e) => setForm({ ...form, deliveredAt: e.target.value })}
                type="date"
                className="admin-input"
              />
            </label>
          </div>
          <ImageInput
            value={form.proofImage}
            onChange={(proofImage) => setForm({ ...form, proofImage })}
            label="PROOF IMAGE / INVOICE"
            placeholder="Paste image URL or upload the invoice / payment screenshot"
            maxDimension={1280}
          />
          <label className="inline-flex items-center gap-2 text-[10px] font-black tracking-wide text-[#64748b]">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4 accent-[#0f4c81]"
            />
            VISIBLE ON /proofs (uncheck to hide without deleting)
          </label>
          <div className="flex items-center gap-3">
            <button onClick={submit} disabled={saving} className="admin-primary disabled:opacity-60">
              {saving ? <FiRefreshCw className="animate-spin" /> : editingId ? <FiEdit3 /> : <FiPlus />}
              {saving ? "SAVING…" : editingId ? "SAVE CHANGES" : "PUBLISH PROOF"}
            </button>
            {editingId && (
              <button onClick={resetForm} className="text-[10px] font-black tracking-[.12em] text-[#64748b] hover:text-[#0f172a]">
                CANCEL EDITING
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Proofs list */}
      <section className="overflow-hidden rounded-xl border border-[#e5e8ef] bg-white">
        <div className="flex items-center justify-between border-b border-[#e5e8ef] px-5 py-4">
          <div>
            <h2 className="font-black text-[#0f172a]">Published proofs</h2>
            <p className="mt-1 text-xs text-[#64748b]">{proofs.length} total · {proofs.filter((p) => p.isActive).length} visible on the website</p>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-[#dbe2ec] px-3 py-2 text-[10px] font-black text-[#0f4c81] transition hover:bg-[#f1f5fb]"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} /> REFRESH
          </button>
        </div>

        {notice && (
          <div className={`border-b px-5 py-3 text-xs font-bold ${notice.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
            {notice.text}
          </div>
        )}

        <div className="divide-y divide-[#e5e8ef]">
          {loading && proofs.length === 0 ? (
            <div className="p-8 text-center text-xs font-bold text-[#64748b]">Loading proofs…</div>
          ) : proofs.length === 0 ? (
            <div className="p-8 text-center text-xs font-bold text-[#64748b]">No proofs yet — publish the first verified delivery on the left.</div>
          ) : (
            proofs.map((proof) => (
              <div key={proof.id} className={`flex flex-wrap items-center gap-4 p-4 ${proof.isActive ? "" : "bg-[#f8fafc] opacity-75"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proof.proofImage || PLACEHOLDER_PROOF_IMAGE}
                  alt={`Proof ${proof.orderCode}`}
                  className="h-16 w-20 shrink-0 rounded-lg border border-[#e5e8ef] object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-black text-[#0f172a]">{proof.customerName}</p>
                    <span className="rounded bg-[#e0eefb] px-1.5 py-0.5 font-mono text-[9px] font-black text-[#0f4c81]">{proof.orderCode}</span>
                    {proof.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700">
                        <FiCheckCircle /> Visible
                      </span>
                    ) : (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase text-amber-700">Hidden</span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs font-medium text-[#64748b]">{proof.productTitle}</p>
                  <p className="mt-1 text-[11px] font-bold text-[#0f4c81]">
                    {formatINR(proof.amount)} · {deliveredLabel(proof.deliveredAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Action onClick={() => startEdit(proof)} label="Edit" icon={FiEdit3} />
                  <Action onClick={() => toggleActive(proof)} label={proof.isActive ? "Hide from website" : "Show on website"} icon={proof.isActive ? FiEyeOff : FiEye} />
                  <Action onClick={() => remove(proof.id)} label="Delete" icon={FiTrash2} danger />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
