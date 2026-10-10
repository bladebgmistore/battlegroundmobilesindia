"use client";

import { useCallback, useEffect, useState } from "react";
import { FiBell, FiPlus, FiRadio, FiRefreshCw, FiTrash2, FiUsers } from "react-icons/fi";

type Announcement = {
  id: string;
  title: string;
  message: string;
  badge: string;
  target: "all" | "user";
  targetUserId: string | null;
  targetEmail: string | null;
  createdBy: string | null;
  createdAt: string;
};

type TargetUser = { id: string; email: string; name: string };

const BADGES = ["General", "Offer", "Urgent Maintenance", "Update"] as const;

const BADGE_STYLE: Record<string, string> = {
  General: "border-[#dbe2ec] bg-[#f1f5fb] text-[#64748b]",
  Offer: "border-pink-200 bg-pink-50 text-pink-600",
  "Urgent Maintenance": "border-red-200 bg-red-50 text-red-600",
  Update: "border-indigo-200 bg-indigo-50 text-indigo-600",
};

/**
 * Admin "Announcements / Broadcasts" tool.
 *
 * Compose a title + message, pick a notification type badge (General, Offer,
 * Urgent Maintenance, Update) and a target (all users or one specific user).
 * Publishing instantly pushes the announcement into the target users'
 * header notification bell.
 */
export default function AdminAnnouncementsPanel({ onToast }: { onToast?: (message: string) => void }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [users, setUsers] = useState<TargetUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [badge, setBadge] = useState<(typeof BADGES)[number]>("General");
  const [target, setTarget] = useState<"all" | "user">("all");
  const [targetUserId, setTargetUserId] = useState("");

  const load = useCallback(async () => {
    try {
      const [annRes, userRes] = await Promise.all([
        fetch("/api/admin/announcements", { cache: "no-store", credentials: "same-origin" }),
        fetch("/api/admin/users", { cache: "no-store", credentials: "same-origin" }),
      ]);
      const annData = await annRes.json().catch(() => null);
      const userData = await userRes.json().catch(() => null);
      if (annRes.ok && annData?.announcements) setAnnouncements(annData.announcements);
      if (userRes.ok && userData?.users) {
        setUsers(userData.users.map((u: { id: string; email: string; name: string }) => ({ id: u.id, email: u.email, name: u.name })));
      }
    } catch {
      // next mount retries
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const kick = setTimeout(() => void load(), 0);
    return () => clearTimeout(kick);
  }, [load]);

  const publish = async () => {
    if (!title.trim() || !message.trim()) {
      setError("Title and message are required.");
      return;
    }
    if (target === "user" && !targetUserId) {
      setError("Select the user this announcement targets.");
      return;
    }
    setPublishing(true);
    setError("");
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), message: message.trim(), badge, target, targetUserId: target === "user" ? targetUserId : null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not publish the announcement.");
        return;
      }
      onToast?.(target === "all" ? "Announcement broadcast to all users." : "Announcement sent to the selected user.");
      setTitle("");
      setMessage("");
      setBadge("General");
      setTarget("all");
      setTargetUserId("");
      await load();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setPublishing(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this announcement? Users who haven't read it will no longer see it.")) return;
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setAnnouncements((current) => current.filter((a) => a.id !== id));
        onToast?.("Announcement deleted.");
      }
    } catch {
      onToast?.("Could not delete the announcement.");
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
      {/* Composer */}
      <section className="h-fit rounded-xl border border-[#e5e8ef] bg-white p-5">
        <div className="flex items-center gap-2 text-[#0f4c81]">
          <FiRadio />
          <p className="text-[10px] font-black tracking-[.14em]">BROADCAST</p>
        </div>
        <h2 className="mt-3 text-xl font-black text-[#0f172a]">New Announcement</h2>
        <p className="mt-2 text-xs leading-5 text-[#64748b]">
          Publishes instantly to the notification bell of every targeted user.
        </p>

        <div className="mt-5 grid gap-3">
          <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-[#64748b]">TITLE
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Flash Sale this weekend" className="admin-input" maxLength={180} />
          </label>
          <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-[#64748b]">MESSAGE
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write the announcement content…" rows={5} className="admin-input resize-none py-3" style={{ height: "auto" }} />
          </label>
          <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-[#64748b]">NOTIFICATION TYPE
            <div className="grid grid-cols-2 gap-2">
              {BADGES.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBadge(b)}
                  className={`rounded-xl border px-3 py-2.5 text-[10px] font-black transition ${badge === b ? "border-[#0f4c81] bg-[#0f4c81] text-white shadow-[0_6px_18px_rgba(15,76,129,.25)]" : "border-[#dbe2ec] bg-white text-[#64748b] hover:text-[#0f172a]"}`}
                >
                  {b.toUpperCase()}
                </button>
              ))}
            </div>
          </label>
          <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-[#64748b]">TARGET
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTarget("all")}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-[10px] font-black transition ${target === "all" ? "border-[#0f4c81] bg-[#0f4c81] text-white" : "border-[#dbe2ec] bg-white text-[#64748b] hover:text-[#0f172a]"}`}
              >
                <FiUsers /> ALL USERS
              </button>
              <button
                type="button"
                onClick={() => setTarget("user")}
                className={`rounded-xl border px-3 py-2.5 text-[10px] font-black transition ${target === "user" ? "border-[#0f4c81] bg-[#0f4c81] text-white" : "border-[#dbe2ec] bg-white text-[#64748b] hover:text-[#0f172a]"}`}
              >
                SPECIFIC USER
              </button>
            </div>
          </label>
          {target === "user" && (
            <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-[#64748b]">SELECT USER
              <select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} className="admin-input">
                <option value="">-- Choose a user --</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.email}</option>)}
              </select>
            </label>
          )}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[11px] font-bold text-red-600">{error}</p>}
          <button onClick={() => void publish()} disabled={publishing} className="admin-primary">
            {publishing ? <FiRefreshCw className="animate-spin" /> : <FiPlus />} {publishing ? "PUBLISHING…" : "PUBLISH ANNOUNCEMENT"}
          </button>
        </div>
      </section>

      {/* Broadcast log */}
      <section className="overflow-hidden rounded-xl border border-[#e5e8ef] bg-white">
        <div className="flex items-center justify-between border-b border-[#e5e8ef] p-5">
          <div>
            <h2 className="font-black text-[#0f172a]">Announcement Log</h2>
            <p className="mt-1 text-xs text-[#64748b]">Everything published so far</p>
          </div>
          <span className="rounded bg-[#f1f5fb] px-2 py-1 text-[10px] font-bold text-[#64748b]">{announcements.length} TOTAL</span>
        </div>
        <div className="max-h-[70vh] divide-y divide-[#e5e8ef] overflow-y-auto">
          {announcements.length ? announcements.map((a) => (
            <article key={a.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e0eefb] text-[#0f4c81]"><FiBell /></span>
                    <p className="text-sm font-black text-[#0f172a]">{a.title}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${BADGE_STYLE[a.badge] ?? BADGE_STYLE.General}`}>{a.badge}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black ${a.target === "all" ? "border-[#0f4c81]/30 bg-[#e0eefb] text-[#0f4c81]" : "border-[#dbe2ec] bg-[#f8fafc] text-[#64748b]"}`}>
                      <FiUsers /> {a.target === "all" ? "ALL USERS" : a.targetEmail ?? "SPECIFIC USER"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#64748b]">{a.message}</p>
                  <p className="mt-2 text-[10px] font-semibold text-[#94a3b8]">
                    {new Date(a.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    {a.createdBy ? ` · by ${a.createdBy}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => void remove(a.id)}
                  className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-[9px] font-black text-red-600 transition-colors hover:bg-red-50"
                >
                  <FiTrash2 /> DELETE
                </button>
              </div>
            </article>
          )) : (
            <p className="p-9 text-center text-sm text-[#64748b]">
              {loading ? "Loading announcements…" : "No announcements published yet."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
