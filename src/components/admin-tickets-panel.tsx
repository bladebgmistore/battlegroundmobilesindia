"use client";

import { useCallback, useEffect, useState } from "react";
import { FiArrowLeft, FiCheckCircle, FiClock, FiMessageSquare, FiPackage, FiRefreshCw, FiXCircle } from "react-icons/fi";
import { SupportChat } from "@/components/support-chat";

type Ticket = {
  id: string;
  orderId: string;
  orderCode: string;
  userId: string;
  customerName: string | null;
  customerEmail: string | null;
  productName: string;
  status: string;
  unreadCount: number;
  lastMessage: string | null;
  lastMessageAt: string | Date | null;
  createdAt: string;
};

/**
 * Admin "Support Tickets" desk — order-based customer tickets.
 *
 * Lists every open ticket with a live unread badge (polled), opens the
 * real-time chat, and can "Close & Resolve Ticket" — which permanently
 * deletes the ticket and its chat history from both dashboards.
 */
export default function AdminTicketsPanel({ onToast }: { onToast?: (message: string) => void }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const toast = useCallback((message: string) => onToast?.(message), [onToast]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tickets", { cache: "no-store", credentials: "same-origin" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.tickets) {
        setTickets(data.tickets);
        // If the open ticket was resolved elsewhere, drop it from view.
        setActiveId((current) => (current && data.tickets.some((t: Ticket) => t.id === current) ? current : null));
      }
    } catch {
      // next poll retries
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const kick = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 4000);
    return () => { clearTimeout(kick); clearInterval(timer); };
  }, [load]);

  const active = tickets.find((t) => t.id === activeId) ?? null;

  const resolve = async (ticket: Ticket) => {
    if (!confirm(`Close & resolve ticket for ${ticket.orderCode}?\n\nThe ticket and its entire chat history will be permanently deleted from both dashboards.`)) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/admin/tickets/${ticket.id}/resolve`, { method: "POST", credentials: "same-origin" });
      if (res.ok) {
        setTickets((current) => current.filter((t) => t.id !== ticket.id));
        setActiveId(null);
        toast(`Ticket ${ticket.orderCode} resolved — chat history cleared.`);
      } else {
        toast("Could not resolve the ticket.");
      }
    } catch {
      toast("Network error while resolving the ticket.");
    } finally {
      setResolving(false);
    }
  };

  const when = (value: string | Date | null) => {
    if (!value) return "—";
    const d = new Date(value);
    return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      {/* Ticket list */}
      <section className={`overflow-hidden rounded-xl border border-[#e5e8ef] bg-white ${active ? "hidden lg:block" : ""}`}>
        <div className="flex items-center justify-between border-b border-[#e5e8ef] p-5">
          <div>
            <h2 className="font-black text-[#0f172a]">Support Tickets</h2>
            <p className="mt-1 text-xs text-[#64748b]">Live order-based customer chats</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#f1f5fb] px-2 py-1 text-[10px] font-bold text-[#64748b]">{tickets.length} OPEN</span>
            <button onClick={() => void load()} className="grid h-8 w-8 place-items-center rounded-lg border border-[#dbe2ec] text-[#64748b] transition hover:text-[#0f4c81]" title="Refresh">
              <FiRefreshCw className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
        <div className="max-h-[70vh] divide-y divide-[#e5e8ef] overflow-y-auto">
          {tickets.length ? tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveId(t.id)}
              className={`block w-full p-4 text-left transition ${activeId === t.id ? "bg-[#e0eefb]" : "hover:bg-[#f8fafc]"} ${t.unreadCount > 0 ? "bg-[#f3f8fe]" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-black text-[#0f4c81]">{t.orderCode}</p>
                  <p className="mt-0.5 truncate text-sm font-bold text-[#0f172a]">{t.customerName || "Customer"}</p>
                  <p className="truncate text-[11px] text-[#64748b]">{t.customerEmail ?? ""}</p>
                </div>
                {t.unreadCount > 0 && (
                  <span className="shrink-0 rounded-full bg-[#e11d48] px-2 py-0.5 text-[9px] font-black text-white">{t.unreadCount} NEW</span>
                )}
              </div>
              <p className="mt-1.5 truncate text-[11px] text-[#64748b]"><FiPackage className="inline" /> {t.productName}</p>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#94a3b8]">
                <span className="truncate">{t.lastMessage ?? "No messages yet"}</span>
                <span className="ml-2 shrink-0 inline-flex items-center gap-1"><FiClock /> {when(t.lastMessageAt ?? t.createdAt)}</span>
              </div>
            </button>
          )) : (
            <p className="p-9 text-center text-sm text-[#64748b]">
              {loading ? "Loading tickets…" : "No open support tickets. New &quot;Chat with Admin&quot; tickets appear here live."}
            </p>
          )}
        </div>
      </section>

      {/* Chat pane */}
      <section className={`flex min-h-[60vh] flex-col overflow-hidden rounded-xl border border-[#e5e8ef] bg-white ${active ? "" : "hidden lg:flex lg:items-center lg:justify-center"}`}>
        {active ? (
          <>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e8ef] p-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black tracking-[.14em] text-[#0f4c81]">TICKET · {active.orderCode}</p>
                <p className="mt-0.5 truncate text-sm font-black text-[#0f172a]">
                  {active.productName} — {active.customerName || "Customer"}
                  {active.customerEmail ? <span className="font-medium text-[#64748b]"> ({active.customerEmail})</span> : null}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => resolve(active)}
                  disabled={resolving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-black text-red-600 transition hover:bg-red-600 hover:text-white disabled:opacity-50"
                  title="Mark resolved and permanently delete the ticket + chat history"
                >
                  <FiXCircle /> {resolving ? "RESOLVING…" : "CLOSE & RESOLVE TICKET"}
                </button>
                <button onClick={() => setActiveId(null)} className="grid h-9 w-9 place-items-center rounded-lg border border-[#dbe2ec] text-[#64748b] hover:text-[#0f172a] lg:hidden" aria-label="Back to tickets">
                  <FiArrowLeft />
                </button>
              </div>
            </header>
            <SupportChat
              ticketId={active.id}
              apiBase="/api/admin/tickets"
              viewer="admin"
              emptyHint="No messages yet — reply to start the conversation."
              onResolved={() => {
                setTickets((current) => current.filter((t) => t.id !== active.id));
                setActiveId(null);
                toast(`Ticket ${active.orderCode} was resolved — chat history cleared.`);
              }}
            />
          </>
        ) : (
          <div className="p-10 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e0eefb] text-2xl text-[#0f4c81]"><FiMessageSquare /></span>
            <p className="mt-4 text-sm font-black text-[#0f172a]">Select a ticket to open the chat</p>
            <p className="mt-1 text-xs text-[#64748b]">Customer tickets from &quot;Chat with Admin&quot; appear here in real time.</p>
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#dcf5e8] bg-[#f3fbf7] px-3 py-1.5 text-[10px] font-bold text-[#0e9f6e]">
              <FiCheckCircle /> Resolved tickets are permanently deleted from both dashboards
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
