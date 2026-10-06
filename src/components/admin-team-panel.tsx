"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FiCheckCircle,
  FiInfo,
  FiMail,
  FiRefreshCw,
  FiShield,
  FiSlash,
  FiTrash2,
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";
import {
  ROLE_META,
  ROLE_SCOPES,
  STAFF_ROLES,
  isStaffRole,
  roleLabel,
  type AdminScope,
  type StaffRole,
} from "@/lib/rbac";

type Member = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  addedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const SCOPE_LABEL: Record<AdminScope, string> = {
  overview: "Overview",
  catalog: "Catalog & Coupons",
  orders: "Orders",
  messages: "Messages",
  feedbacks: "Feedbacks",
  logs: "Visitor Logs",
  users: "Users",
  site: "Site Controls",
  team: "Team Manager",
};

const when = (value: string | null) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return value;
  }
};

/**
 * Team & Roles — owner only.
 * Add admins, managers and moderators by their Google (Gmail) address.
 * The change is live immediately: the member just signs in with Google and
 * the admin panel opens with their role's permissions. Suspending or
 * removing a member revokes access on the very next request.
 */
export default function AdminTeamPanel({ ownerEmail }: { ownerEmail: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("moderator");
  const [adding, setAdding] = useState(false);

  const flash = (kind: "ok" | "err", text: string) => {
    setNotice({ kind, text });
    setTimeout(() => setNotice(null), 3500);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/staff", { cache: "no-store", credentials: "same-origin" });
      const data = await res.json().catch(() => null);
      setMembers(data?.staff ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  const add = async () => {
    if (!email.trim()) {
      flash("err", "Email daalna zaroori hai — member ka Google account email.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        flash("err", data?.error ?? "Member add nahi ho paya.");
        return;
      }
      flash("ok", `${roleLabel(role)} role de diya — member Google se login karte hi admin panel use kar payega.`);
      setEmail("");
      setName("");
      setRole("moderator");
      await load();
    } finally {
      setAdding(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>, okText: string) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) flash("err", data?.error ?? "Update nahi ho paya.");
      else flash("ok", okText);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (member: Member) => {
    if (!confirm(`Remove ${member.email} from the team? They will instantly lose admin access.`)) return;
    setBusyId(member.id);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) flash("err", data?.error ?? "Remove nahi ho paya.");
      else flash("ok", "Member removed — access turant band.");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Add member + role guide ─────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
        <section className="h-fit rounded-xl border border-[#e5e8ef] bg-white p-6">
          <div className="flex items-center gap-2 text-[#0f4c81]">
            <FiUserPlus />
            <p className="text-[10px] font-black tracking-[.14em]">TEAM MANAGEMENT</p>
          </div>
          <h2 className="mt-3 text-xl font-black text-[#0f172a]">Add team member</h2>
          <p className="mt-2 text-xs leading-5 text-[#64748b]">
            Member ka <b>Google (Gmail) email</b> daalein aur role chunein. Wo Google se login karte hi admin panel
            unke role ke permissions ke saath khul jayega — koi password nahi chahiye.
          </p>

          <div className="mt-5 grid gap-3">
            <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-[#64748b]">
              GOOGLE EMAIL
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="member@gmail.com"
                type="email"
                className="admin-input"
              />
            </label>
            <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-[#64748b]">
              NAME <span className="font-normal normal-case tracking-normal text-[#94a3b8]">(optional — Google se auto aa jayega)</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Member ka naam" className="admin-input" />
            </label>

            <div className="grid gap-2">
              <p className="text-[10px] font-black tracking-[.12em] text-[#64748b]">ROLE</p>
              <div className="grid gap-2">
                {STAFF_ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                      role === r
                        ? "border-[#0f4c81] bg-[#f3f8fe] shadow-[0_6px_18px_rgba(15,76,129,.12)]"
                        : "border-[#e5e8ef] bg-white hover:border-[#b9c6d8]"
                    }`}
                  >
                    <span className={`mt-0.5 rounded-md px-2 py-1 text-[9px] font-black ${ROLE_META[r].badge}`}>
                      {ROLE_META[r].label.toUpperCase()}
                    </span>
                    <span className="text-[11px] leading-4 text-[#64748b]">{ROLE_META[r].tagline}</span>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={add} disabled={adding} className="admin-primary disabled:opacity-60">
              <FiUserPlus /> {adding ? "ADDING…" : "ADD TO TEAM"}
            </button>
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-[#cfe3f7] bg-[#f3f8fe] p-3 text-[11px] leading-4 text-[#64748b]">
            <FiInfo className="mt-0.5 shrink-0 text-[#0f4c81]" />
            <span>
              <b className="text-[#0f4c81]">Owner</b> role sirf <code className="rounded bg-white px-1">OWNER_EMAIL</code>{" "}
              env variable se aata hai ({ownerEmail}) — yahan se change nahi ho sakta, taaki site kabhi lock na ho.
            </span>
          </div>
        </section>

        {/* ── Role permission guide ─────────────────────────────── */}
        <section className="h-fit rounded-xl border border-[#e5e8ef] bg-white p-6">
          <div className="flex items-center gap-2 text-[#0f4c81]">
            <FiShield />
            <p className="text-[10px] font-black tracking-[.14em]">PERMISSION GUIDE</p>
          </div>
          <h2 className="mt-3 text-xl font-black text-[#0f172a]">Kaun kya kar sakta hai</h2>
          <p className="mt-2 text-xs leading-5 text-[#64748b]">
            Har role ka dashboard menu aur API access in scopes tak hi simit rehta hai.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {STAFF_ROLES.map((r) => (
              <article key={r} className="rounded-xl border border-[#e5e8ef] bg-[#f8fafc] p-4">
                <span className={`inline-flex rounded-md px-2 py-1 text-[9px] font-black ${ROLE_META[r].badge}`}>
                  {ROLE_META[r].label.toUpperCase()}
                </span>
                <ul className="mt-3 space-y-1.5">
                  {ROLE_SCOPES[r].map((scope) => (
                    <li key={scope} className="flex items-center gap-1.5 text-[11px] font-bold text-[#334155]">
                      <FiCheckCircle className="shrink-0 text-[#0e9f6e]" /> {SCOPE_LABEL[scope]}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <p className="mt-4 rounded-lg border border-[#e5e8ef] bg-[#f8fafc] px-3 py-2 text-[11px] leading-4 text-[#64748b]">
            <b className="text-[#0f172a]">Owner</b> sab kuch kar sakta hai — Team & Roles manager aur <b>order delete</b>{" "}
            bhi sirf owner ke paas hai. Role badalte ya suspend karte hi change <b>turant</b> lagoo hota hai; member ko
            dobara login karne ki zaroorat nahi.
          </p>
        </section>
      </div>

      {/* ── Members table ───────────────────────────────────────── */}
      <section className="overflow-hidden rounded-xl border border-[#e5e8ef] bg-white">
        <div className="flex items-center justify-between border-b border-[#e5e8ef] p-5">
          <h2 className="flex items-center gap-2 font-black text-[#0f172a]">
            <FiUsers className="text-[#0f4c81]" /> Team members
          </h2>
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#f1f5fb] px-2 py-1 text-[10px] font-bold text-[#64748b]">
              {members.length} MEMBERS
            </span>
            <button
              onClick={load}
              className="inline-flex items-center gap-1 rounded border border-[#dbe2ec] px-3 py-2 text-[10px] font-black text-[#64748b] transition hover:text-[#0f172a]"
            >
              <FiRefreshCw className={loading ? "animate-spin" : ""} /> REFRESH
            </button>
          </div>
        </div>

        {notice && (
          <p
            className={`mx-5 mt-4 rounded-lg border px-3 py-2 text-xs font-bold ${
              notice.kind === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-600"
            }`}
          >
            {notice.text}
          </p>
        )}

        {/* Owner row (from env — not editable) */}
        <div className="divide-y divide-[#eef1f6]">
          <div className="flex flex-wrap items-center gap-3 bg-[#f8fafc] p-4">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#0f4c81] text-sm font-black text-white">
              {ownerEmail?.[0]?.toUpperCase() ?? "O"}
            </span>
            <div className="min-w-0 grow">
              <p className="flex flex-wrap items-center gap-2 text-sm font-black text-[#0f172a]">
                Site Owner
                <span className={`rounded-md px-2 py-0.5 text-[9px] font-black ${ROLE_META.owner.badge}`}>OWNER</span>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-700">ALWAYS ACTIVE</span>
              </p>
              <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-[#64748b]">
                <FiMail className="shrink-0 text-[#0f4c81]" /> {ownerEmail}{" "}
                <span className="text-[#94a3b8]">· OWNER_EMAIL env se — yahan se edit nahi hota</span>
              </p>
            </div>
          </div>

          {members.length === 0 && !loading && (
            <p className="p-9 text-center text-sm text-[#64748b]">
              Abhi koi team member nahi hai — upar se pehla admin / manager / moderator add karein.
            </p>
          )}
          {loading && <p className="p-9 text-center text-sm text-[#64748b]">Loading team…</p>}

          {members.map((m) => (
            <div key={m.id} className={`flex flex-wrap items-center gap-3 p-4 ${m.isActive ? "" : "opacity-60"}`}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#e0eefb] text-sm font-black text-[#0f4c81]">
                {(m.name || m.email)?.[0]?.toUpperCase() ?? "M"}
              </span>
              <div className="min-w-0 grow">
                <p className="flex flex-wrap items-center gap-2 text-sm font-black text-[#0f172a]">
                  {m.name || m.email.split("@")[0]}
                  <span
                    className={`rounded-md px-2 py-0.5 text-[9px] font-black ${
                      m.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                    }`}
                  >
                    {m.isActive ? "ACTIVE" : "SUSPENDED"}
                  </span>
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 truncate text-xs text-[#64748b]">
                  <span className="inline-flex items-center gap-1.5">
                    <FiMail className="shrink-0 text-[#0f4c81]" /> {m.email}
                  </span>
                  <span className="text-[#94a3b8]">
                    Added {when(m.createdAt)}{m.addedBy ? ` · by ${m.addedBy}` : ""}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={isStaffRole(m.role) ? m.role : "moderator"}
                  disabled={busyId === m.id}
                  onChange={(e) => patch(m.id, { role: e.target.value }, `Role updated to ${roleLabel(e.target.value)}.`)}
                  className={`h-9 cursor-pointer rounded-lg border-0 px-2 text-[10px] font-black ${ROLE_META[m.role]?.badge ?? ROLE_META.customer.badge} disabled:opacity-50`}
                  title="Change role"
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r} value={r} className="bg-white text-[#0f172a]">
                      {ROLE_META[r].label.toUpperCase()}
                    </option>
                  ))}
                </select>
                <button
                  disabled={busyId === m.id}
                  onClick={() =>
                    patch(
                      m.id,
                      { isActive: !m.isActive },
                      m.isActive ? "Member suspended — access turant band." : "Member re-activated.",
                    )
                  }
                  className={`inline-flex items-center gap-1 rounded border px-2.5 py-2 text-[9px] font-black transition disabled:opacity-50 ${
                    m.isActive
                      ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                      : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  {m.isActive ? <FiSlash /> : <FiCheckCircle />} {m.isActive ? "SUSPEND" : "ACTIVATE"}
                </button>
                <button
                  disabled={busyId === m.id}
                  onClick={() => remove(m)}
                  className="inline-flex items-center gap-1 rounded border border-red-200 px-2.5 py-2 text-[9px] font-black text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  <FiTrash2 /> REMOVE
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
