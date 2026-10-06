"use client";

import { useEffect, useState } from "react";
import { FiRefreshCw, FiShield, FiUsers } from "react-icons/fi";

type AppUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
};

const when = (value: string | null) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
};

import { ROLE_META } from "@/lib/rbac";

/**
 * Users panel: every Google account that has signed in, with its current
 * role (customer / moderator / manager / admin / owner).
 * Staff roles are granted from the owner-only "Team & Roles" section.
 */
export default function AdminUsersPanel({ ownerEmail }: { ownerEmail: string }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      setUsers(data?.users ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#e5e8ef] bg-white p-6">
        <div className="flex items-center gap-2 text-[#0f4c81]">
          <FiShield />
          <p className="text-[10px] font-black tracking-[.14em]">ACCESS CONTROL</p>
        </div>
        <h2 className="mt-3 text-xl font-black text-[#0f172a]">Google Sign-In only</h2>
        <p className="mt-2 max-w-2xl text-xs leading-5 text-[#64748b]">
          Password logins have been removed — every visitor signs in with Google. The owner below can add{" "}
          <b>admins, managers and moderators</b> anytime from the <b>Team &amp; Roles</b> section (no redeploy needed).
          The owner role itself comes from the <code className="rounded bg-[#f1f5fb] px-1">OWNER_EMAIL</code>{" "}
          environment variable and can never be edited from the UI.
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#e0eefb] px-3 py-2 text-xs font-black text-[#0f4c81]">
          OWNER: {ownerEmail}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e5e8ef] bg-white">
        <div className="flex items-center justify-between border-b border-[#e5e8ef] p-5">
          <h2 className="flex items-center gap-2 font-black text-[#0f172a]">
            <FiUsers className="text-[#0f4c81]" /> Signed-in users
          </h2>
          <button onClick={load} className="inline-flex items-center gap-1 rounded border border-[#dbe2ec] px-3 py-2 text-[10px] font-black text-[#64748b]">
            <FiRefreshCw className={loading ? "animate-spin" : ""} /> REFRESH
          </button>
        </div>

        {users.length === 0 ? (
          <p className="p-9 text-center text-sm text-[#64748b]">{loading ? "Loading users…" : "No users yet."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#f8fafc] text-[10px] font-black uppercase tracking-[.1em] text-[#64748b]">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">First seen</th>
                  <th className="px-4 py-3">Last login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef1f6]">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-[#f8fafc]">
                    <td className="flex items-center gap-3 px-4 py-3">
                      {user.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#f1f5fb] text-xs font-black text-[#0f4c81]">
                          {user.name?.[0]?.toUpperCase() ?? "U"}
                        </span>
                      )}
                      <span className="font-bold text-[#0f172a]">{user.name}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#334155]">{user.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-1 text-[10px] font-black ${
                          ROLE_META[user.role]?.badge ?? "bg-[#f1f5fb] text-[#64748b]"
                        }`}
                      >
                        {(ROLE_META[user.role]?.label ?? user.role).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#64748b]">{when(user.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-[#64748b]">{when(user.lastLoginAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
