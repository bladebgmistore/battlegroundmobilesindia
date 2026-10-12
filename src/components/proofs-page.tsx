"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { FiCalendar, FiCheckCircle, FiClock, FiEye, FiShield, FiUser, FiX } from "react-icons/fi";
import { GridBackdrop, PageTitle, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { formatINR } from "@/lib/store-data";
import { PROOF_SEED, proofImageFor } from "@/lib/proof-seed";
import { PLACEHOLDER_PROOF_IMAGE, type Proof } from "@/lib/proof-shared";

/**
 * Offline fallback — the pre-loaded deliveries straight from
 * src/lib/proof-seed.ts. Used only when the database cannot be reached, so the
 * page still shows real product titles & prices instead of an empty state.
 */
const FALLBACK_PROOFS: Proof[] = PROOF_SEED.map((seed, index) => ({
  id: `seed-${index}`,
  customerName: seed.customerName,
  orderCode: seed.orderCode,
  productTitle: seed.productTitle,
  amount: seed.amount,
  proofImage: proofImageFor(seed.orderCode),
  isActive: true,
  deliveredAt: new Date(seed.deliveredAt).toISOString(),
  sortOrder: seed.sortOrder,
  createdAt: null,
  updatedAt: null,
}));

/** Shown when a proof has no uploaded image yet. */


const deliveredLabel = (iso: string | null) => {
  if (!iso) return "Recently delivered";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Recently delivered";
  return `Delivered ${date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
};

const cardVariants = {
  hidden: { opacity: 0, y: 26, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 220, damping: 24 },
  },
};

/**
 * Public "Customer Proofs / Order Deliveries" page.
 *
 * Responsive grid of verified delivery cards — each card shows the proof
 * image/invoice, the customer name, the random order id (#ORD-xxxx), the
 * exact product title and the amount paid (₹). Data comes live from
 * GET /api/proofs, so anything the admin publishes appears here instantly.
 */
export default function ProofsPage() {
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [lightbox, setLightbox] = useState<Proof | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/proofs?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((data: { proofs?: Proof[]; databaseOnline?: boolean }) => {
        if (!alive) return;
        setProofs(Array.isArray(data?.proofs) ? data.proofs : []);
        setOffline(data?.databaseOnline === false);
      })
      .catch(() => {
        if (!alive) return;
        setProofs(FALLBACK_PROOFS);
        setOffline(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const totalPaid = useMemo(() => proofs.reduce((sum, proof) => sum + proof.amount, 0), [proofs]);

  return (
    <>
      <GridBackdrop />
      <SiteHeader />
      <main>
        <PageTitle
          eyebrow="100% VERIFIED DELIVERIES"
          title="Customer Proofs"
          copy="Real orders delivered to real players. Every card below is a completed BGMI account or UC delivery — published only after the handover was confirmed."
        />

        {/* Trust strip */}
        <section className="mx-auto max-w-7xl px-5 pb-10 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: FiCheckCircle, label: "VERIFIED ORDERS", value: loading ? "…" : `${proofs.length}+`, sub: "Deliveries published" },
              { icon: FiShield, label: "SECURE HANDOVERS", value: "100%", sub: "Guided & recorded" },
              { icon: FiClock, label: "VALUE DELIVERED", value: loading ? "…" : formatINR(totalPaid), sub: "Across published proofs" },
            ].map(({ icon: Icon, label, value, sub }) => (
              <div key={label} className="premium-card flex items-center gap-4 p-5" data-aos="fade-up">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#e0eefb] text-xl text-[#0f4c81]">
                  <Icon />
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] font-black tracking-[.16em] text-[#64748b]">{label}</p>
                  <p className="mt-0.5 truncate text-xl font-black tracking-[-.03em] text-[#0f172a]">{value}</p>
                  <p className="text-[10px] font-medium text-[#94a3b8]">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Proofs grid */}
        <section className="mx-auto max-w-7xl px-5 pb-8 lg:px-8">
          {loading && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="premium-card overflow-hidden rounded-2xl">
                  <div className="aspect-[4/3] animate-pulse bg-[#e6ebf2]" />
                  <div className="space-y-3 p-5">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-[#e6ebf2]" />
                    <div className="h-3 w-full animate-pulse rounded bg-[#e6ebf2]" />
                    <div className="h-3 w-5/6 animate-pulse rounded bg-[#e6ebf2]" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && offline && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
              Live database is unreachable right now — showing the pre-loaded deliveries. Reconnect the database to see admin-published proofs.
            </div>
          )}

          {!loading && !offline && proofs.length === 0 && (
            <div className="premium-card p-10 text-center">
              <p className="text-sm font-black text-[#0f172a]">No proofs published yet.</p>
              <p className="mt-2 text-xs text-[#64748b]">Verified deliveries will appear here as soon as orders are completed.</p>
            </div>
          )}

          {!loading && !offline && proofs.length > 0 && (
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
              className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {proofs.map((proof) => (
                <motion.article key={proof.id} variants={cardVariants} className="premium-card gaming-card group flex flex-col overflow-hidden rounded-2xl">
                  {/* Proof image / invoice */}
                  <button
                    type="button"
                    onClick={() => setLightbox(proof)}
                    className="relative aspect-[4/3] overflow-hidden bg-[#eef1f6] text-left"
                    aria-label={`View proof image for order ${proof.orderCode}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={proof.proofImage || PLACEHOLDER_PROOF_IMAGE}
                      alt={`Delivery proof for ${proof.orderCode}`}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-[#0e9f6e] px-2 py-1 text-[9px] font-black tracking-[.12em] text-white shadow">
                      <FiCheckCircle /> VERIFIED
                    </span>
                    <span className="absolute right-3 top-3 rounded-md bg-white/95 px-2 py-1 font-mono text-[10px] font-black tracking-[.06em] text-[#0f4c81] shadow">
                      {proof.orderCode}
                    </span>
                    <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-[9px] font-bold tracking-[.1em] text-white backdrop-blur">
                      <FiEye /> VIEW PROOF
                    </span>
                  </button>

                  {/* Card details */}
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#0f172a]">
                        <FiUser className="text-[#0f4c81]" /> {proof.customerName}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#64748b]">
                        <FiCalendar className="text-[#94a3b8]" /> {deliveredLabel(proof.deliveredAt)}
                      </span>
                    </div>
                    <h3 className="mt-3 line-clamp-2 min-h-[40px] text-[13px] font-black leading-5 tracking-[.01em] text-[#0f172a]">
                      {proof.productTitle}
                    </h3>
                    <div className="mt-auto flex items-end justify-between border-t border-[#e5e8ef] pt-4">
                      <div>
                        <p className="text-[9px] font-black tracking-[.14em] text-[#94a3b8]">AMOUNT PAID</p>
                        <p className="mt-0.5 text-lg font-black tracking-[-.02em] text-[#0f4c81]">{formatINR(proof.amount)}</p>
                      </div>
                      <span className="rounded-md bg-[#e0eefb] px-2 py-1 font-mono text-[10px] font-black tracking-[.06em] text-[#0f4c81]">
                        {proof.orderCode}
                      </span>
                    </div>
                  </div>
                </motion.article>
              ))}
            </motion.div>
          )}
        </section>

        {/* Reassurance CTA */}
        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div data-aos="zoom-in" className="premium-card px-7 py-10 text-center sm:px-12">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e0eefb] text-2xl text-[#0f4c81]">
              <FiShield />
            </span>
            <h2 className="mt-5 text-3xl font-black tracking-[-.045em] text-[#0f172a]">Your order could be next.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#64748b]">
              Every delivery on this page was completed with a guided, secure handover. Browse the store and get the same experience.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <a href="/accounts" className="btn-primary">EXPLORE ACCOUNTS</a>
              <a href="/uc-purchase" className="btn-outline">EXPLORE UC PACKAGES</a>
            </div>
          </div>
        </section>
      </main>

      {/* Proof image lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
              className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/20 bg-[#0b1f33] shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setLightbox(null)}
                aria-label="Close"
                className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
              >
                <FiX />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightbox.proofImage || PLACEHOLDER_PROOF_IMAGE}
                alt={`Delivery proof for ${lightbox.orderCode}`}
                className="max-h-[70vh] w-full object-contain"
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4 text-white">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{lightbox.customerName} · {lightbox.productTitle}</p>
                  <p className="mt-0.5 text-[11px] font-bold text-white/60">{deliveredLabel(lightbox.deliveredAt)}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs font-black text-[#7dd3fc]">{lightbox.orderCode}</p>
                  <p className="mt-0.5 text-lg font-black text-[#fbbf24]">{formatINR(lightbox.amount)}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SiteFooter />
    </>
  );
}
