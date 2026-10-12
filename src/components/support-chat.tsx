"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiCheckCircle, FiDownload, FiImage, FiPaperclip, FiSend } from "react-icons/fi";
import { compressImageFile, formatBytes } from "@/lib/client-image";

export type ChatMessage = {
  id: string;
  ticketId: string;
  sender: "user" | "admin";
  senderName: string | null;
  message: string;
  attachment: string | null;
  attachmentName: string | null;
  attachmentType: string | null;
  isRead: boolean;
  createdAt: string;
};

type AttachmentDraft = { dataUrl: string; name: string; type: string; size: number };

const MAX_FILE_BYTES = 1.5 * 1024 * 1024;

/**
 * Shared real-time chat panel for one support ticket — used by the buyer
 * (/support) and by the admin (Support Tickets desk). Messages poll every 3s
 * so both sides see replies within seconds.
 */
export function SupportChat({
  ticketId,
  apiBase,
  viewer,
  emptyHint,
  onResolved,
}: {
  /** Ticket id — used for polling + sending. */
  ticketId: string;
  /** "/api/support/tickets" (buyer) or "/api/admin/tickets" (staff). */
  apiBase: string;
  /** Which side is viewing — controls bubble alignment. */
  viewer: "user" | "admin";
  emptyHint?: string;
  /** Called when the ticket disappears (admin resolved & deleted it). */
  onResolved?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<AttachmentDraft | null>(null);
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState("");
  const [gone, setGone] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/${ticketId}/messages`, { cache: "no-store", credentials: "same-origin" });
      if (res.status === 404 || res.status === 410) {
        setGone(true);
        onResolved?.();
        return;
      }
      const data = await res.json().catch(() => null);
      if (res.ok && data?.messages) {
        setMessages(data.messages);
        setGone(false);
      }
    } catch {
      // network hiccup — the next poll retries
    } finally {
      setLoaded(true);
    }
  }, [apiBase, ticketId, onResolved]);

  // Initial load + 3s polling for near-real-time updates.
  useEffect(() => {
    const kick = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 3000);
    return () => { clearTimeout(kick); clearInterval(timer); };
  }, [load]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const pickFile = async (file?: File) => {
    if (!file) return;
    setAttaching(true);
    setError("");
    try {
      if (file.type.startsWith("image/")) {
        const compressed = await compressImageFile(file, { targetBytes: MAX_FILE_BYTES, maxDimension: 1600 });
        setAttachment({ dataUrl: compressed.dataUrl, name: file.name, type: "image/jpeg", size: compressed.bytes });
      } else {
        if (file.size > MAX_FILE_BYTES) throw new Error("File is too large — please keep it under 1.5 MB.");
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Could not read the selected file."));
          reader.readAsDataURL(file);
        });
        setAttachment({ dataUrl, name: file.name, type: file.type || "application/octet-stream", size: file.size });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not attach that file.");
    } finally {
      setAttaching(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const send = async () => {
    const text = draft.trim();
    if ((!text && !attachment) || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/${ticketId}/messages`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          attachment: attachment?.dataUrl ?? null,
          attachmentName: attachment?.name ?? null,
          attachmentType: attachment?.type ?? null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 410 || res.status === 404) {
          setGone(true);
          onResolved?.();
          return;
        }
        setError(data?.error ?? "Could not send the message.");
        return;
      }
      setDraft("");
      setAttachment(null);
      await load();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSending(false);
    }
  };

  if (gone) {
    return (
      <div className="grid flex-1 place-items-center p-8 text-center">
        <div>
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#dcf5e8] text-2xl text-[#0e9f6e]"><FiCheckCircle /></span>
          <p className="mt-4 text-sm font-black text-[#0f172a]">This ticket has been resolved and closed.</p>
          <p className="mt-1 text-xs text-[#64748b]">The conversation history was cleared by the admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#f8fafc] p-4">
        {!loaded ? (
          <p className="py-10 text-center text-xs font-bold text-[#94a3b8]">Loading conversation…</p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-xs font-bold text-[#94a3b8]">{emptyHint ?? "No messages yet — say hello!"}</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender === viewer;
            const isImage = Boolean(m.attachment && /^data:image\//.test(m.attachment));
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm ${mine ? "rounded-br-sm bg-[#0f4c81] text-white" : "rounded-bl-sm border border-[#e5e8ef] bg-white text-[#0f172a]"}`}>
                  {!mine && m.senderName && (
                    <p className="mb-1 text-[9px] font-black tracking-[.12em] uppercase text-[#0f4c81]">{m.senderName}</p>
                  )}
                  {m.attachment && (
                    <div className="mb-2">
                      {isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.attachment} alt={m.attachmentName ?? "Attachment"} className="max-h-64 rounded-lg border border-white/20 object-contain" />
                      ) : (
                        <a href={m.attachment ?? "#"} download={m.attachmentName ?? "attachment"} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${mine ? "bg-white/15 text-white" : "bg-[#f1f5fb] text-[#0f4c81]"}`}>
                          <FiDownload /> {m.attachmentName ?? "Download file"}
                        </a>
                      )}
                    </div>
                  )}
                  {m.message && <p className="whitespace-pre-wrap leading-6">{m.message}</p>}
                  <p className={`mt-1.5 text-right text-[9px] font-bold ${mine ? "text-white/60" : "text-[#94a3b8]"}`}>
                    {new Date(m.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-[#e5e8ef] bg-white p-3">
        {attachment && (
          <div className="mb-2 flex items-center gap-3 rounded-lg border border-[#e5e8ef] bg-[#f8fafc] p-2">
            {/^data:image\//.test(attachment.dataUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={attachment.dataUrl} alt="Preview" className="h-12 w-12 rounded-md border border-[#e5e8ef] object-cover" />
            ) : (
              <span className="grid h-12 w-12 place-items-center rounded-md border border-[#e5e8ef] bg-white text-[#0f4c81]"><FiImage /></span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-[#0f172a]">{attachment.name}</p>
              <p className="text-[10px] text-[#94a3b8]">{formatBytes(attachment.size)}</p>
            </div>
            <button type="button" onClick={() => setAttachment(null)} className="text-[10px] font-black text-red-600 hover:underline">REMOVE</button>
          </div>
        )}
        {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-bold text-red-600">{error}</p>}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,text/plain"
            className="hidden"
            onChange={(e) => void pickFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={attaching}
            title="Attach a screenshot or file"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#dbe2ec] text-[#64748b] transition hover:border-[#0f4c81] hover:text-[#0f4c81] disabled:opacity-50"
          >
            <FiPaperclip className={attaching ? "animate-pulse" : ""} />
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder="Type your message…"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-[#dbe2ec] px-4 py-2.5 text-sm outline-none focus:border-[#0f4c81]"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || (!draft.trim() && !attachment)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0f4c81] text-white shadow-sm transition hover:bg-[#0a3557] disabled:opacity-50"
            title="Send message"
          >
            <FiSend />
          </button>
        </div>
      </div>
    </div>
  );
}
