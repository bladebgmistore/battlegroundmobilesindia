"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FiArrowLeft, FiClock, FiPackage, FiRefreshCw } from "react-icons/fi";
import { GridBackdrop, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { SupportChat } from "@/components/support-chat";
import { statusInfo } from "@/components/account-page";
import { formatINR } from "@/lib/store-data";

type Ticket = {
  id: string;
  orderId: string;
  orderCode: string;
  productName: string;
  status: string;
  createdAt: string;
};

type OrderSnapshot = {
  id: string;
  orderCode: string;
  productName: string;
  status: string;
  amount: number;
  createdAt: string;
} | null;

/**
 * Buyer-side "Chat with Admin" page — one support ticket per order.
 * Opened from My Orders (/account) via the "Chat with Admin" button, or from
 * the notification bell ("Admin replied to Order #…").
 *
 * /support?orderId=<order id>  → opens (or creates) the ticket for that order
 * /support?orderId=…&ticket=<ticket id> → deep link straight into the chat
 */
export default function SupportPage() {
  const params = useSearchParams();
  const orderId = params.get("orderId") ?? "";
  const ticketParam = params.get("ticket") ?? "";

  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [order, setOrder] = useState<OrderSnapshot>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!orderId && !ticketParam) {
        setError("Missing order reference. Open this page from one of your orders.");
        setLoading(false);
        return;
      }
      try {
        let ticketRow: Ticket | null = null;
        let orderRow: OrderSnapshot = null;

        if (ticketParam) {
          // Deep link straight into an existing conversation.
          const res = await fetch(`/api/support/tickets/${ticketParam}/messages`, { cache: "no-store", credentials: "same-origin" });
          const data = await res.json().catch(() => null);
          if (res.ok && data?.ticket) {
            ticketRow = data.ticket;
            const orderRes = await fetch(`/api/support/tickets?orderId=${encodeURIComponent(data.ticket.orderId)}`, { cache: "no-store", credentials: "same-origin" });
            const orderData = await orderRes.json().catch(() => null);
            orderRow = orderData?.order ?? null;
          }
        } else {
          // Open-or-create the ticket for this order.
          const existing = await fetch(`/api/support/tickets?orderId=${encodeURIComponent(orderId)}`, { cache: "no-store", credentials: "same-origin" });
          if (existing.ok) {
            const data = await existing.json().catch(() => null);
            ticketRow = data?.ticket ?? null;
            orderRow = data?.order ?? null;
          } else {
            const created = await fetch("/api/support/tickets", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId }),
            });
            const data = await created.json().catch(() => null);
            if (created.ok && data?.ticket) {
              ticketRow = data.ticket;
              orderRow = data.order ?? null;
            } else {
              throw new Error(data?.error ?? "Could not open a support ticket for this order.");
            }
          }
        }

        if (!alive) return;
        if (!ticketRow) throw new Error("Could not open a support ticket for this order.");
        setTicket(ticketRow);
        setOrder(orderRow);

        // Opening the chat clears its "Admin replied" bell alerts.
        fetch("/api/notifications", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId: ticketRow.id }),
        }).catch(() => undefined);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Could not open the support chat.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [orderId, ticketParam]);

  const st = statusInfo(order?.status ?? ticket?.status ?? "open");

  return (
    <>
      <GridBackdrop />
      <SiteHeader />
      <main className="mx-auto flex min-h-[70vh] max-w-4xl flex-col px-5 py-10 lg:px-8 lg:py-14">
        <Link href="/account" className="inline-flex w-fit items-center gap-2 text-[10px] font-bold tracking-[.12em] text-[#64748b] hover:text-[#0f172a]">
          <FiArrowLeft /> BACK TO MY ORDERS
        </Link>

        {loading ? (
          <div className="grid flex-1 place-items-center py-24">
            <div className="flex items-center gap-2 text-sm font-bold text-[#64748b]"><FiRefreshCw className="animate-spin" /> Opening your support ticket…</div>
          </div>
        ) : error ? (
          <div className="mt-8 rounded-2xl border border-dashed border-[#dbe2ec] bg-white/60 p-10 text-center">
            <p className="text-sm font-bold text-[#334155]">{error}</p>
            <Link href="/account" className="btn-primary mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black tracking-[.12em]">GO TO MY ORDERS</Link>
          </div>
        ) : ticket ? (
          <section className="mt-6 flex min-h-[60vh] flex-col overflow-hidden rounded-2xl border border-[#e5e8ef] bg-white shadow-sm">
            {/* Chat header: Order ID · Purchased item · Order status */}
            <header className="border-b border-[#e5e8ef] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black tracking-[.16em] text-[#0f4c81]">SUPPORT TICKET · {ticket.orderCode}</p>
                  <h1 className="mt-1.5 flex items-center gap-2 text-lg font-black tracking-[-.02em] text-[#0f172a]">
                    <FiPackage className="shrink-0 text-[#0f4c81]" /> {order?.productName ?? ticket.productName}
                  </h1>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#64748b]">
                    <span className="inline-flex items-center gap-1"><FiClock /> {new Date(ticket.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                    {order && <span>Amount: <b className="text-[#0f172a]">{formatINR(order.amount)}</b></span>}
                  </div>
                </div>
                <span className={`inline-block h-fit rounded-full px-3 py-1.5 text-[10px] font-bold ${st.className}`}>{st.label}</span>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-[#64748b]">
                Chat directly with the store team about this order. Attach payment proofs or error screenshots if needed.
              </p>
            </header>
            <SupportChat
              ticketId={ticket.id}
              apiBase="/api/support/tickets"
              viewer="user"
              emptyHint="No messages yet — tell us what you need help with."
            />
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
