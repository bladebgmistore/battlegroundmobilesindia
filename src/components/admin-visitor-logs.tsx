"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiActivity, FiDownload, FiEye, FiRefreshCw, FiSearch, FiTrash2, FiUsers } from "react-icons/fi";

export type SiteLog = {
  id: string;
  userEmail: string | null;
  userName: string | null;
  ipAddress: string | null;
  pageUrl: string;
  referrer: string | null;
  userAgent: string | null;
  city: string | null;
  country: string | null;
  createdAt: string;
};

type Stats = {
  total: number;
  today: number;
  uniqueVisitors: number;
  topPages: { pageUrl: string; views: number }[];
};

const PAGE_SIZE = 100;

function formatWhen(value: string): string {
  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return value;
  }
}

function deviceOf(userAgent: string | null): string {
  if (!userAgent) return "—";
  if (/android/i.test(userAgent)) return "Android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "iOS";
  if (/windows/i.test(userAgent)) return "Windows";
  if (/mac os/i.test(userAgent)) return "macOS";
  if (/linux/i.test(userAgent)) return "Linux";
  return "Other";
}

/**
 * Live visitor & page tracking table (owner only).
 * Reads /api/admin/logs — every row is one page view by a signed-in user.
 */
export default function VisitorLogsPanel() {
  const [logs, setLogs] = useState<SiteLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [emailFilter, setEmailFilter] = useState("");
  const [pathFilter, setPathFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
      if (emailFilter.trim()) params.set("email", emailFilter.trim());
      if (pathFilter.trim()) params.set("path", pathFilter.trim());

      const response = await fetch(`/api/admin/logs?${params.toString()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) {
        setError(response.status === 403 ? "Owner access only." : "Could not load visitor logs.");
        return;
      }
      const data = await response.json();
      setLogs(data.logs ?? []);
      setStats(data.stats ?? null);
      setTotal(data.total ?? 0);
      setError("");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [page, emailFilter, pathFilter]);

  useEffect(() => {
    // Deferred so the first paint is never blocked by the fetch.
    const id = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(id);
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [autoRefresh, load]);

  const exportCsv = () => {
    const header = ["Timestamp", "User Email", "Name", "IP Address", "Page URL", "Device", "Referrer"];
    const rows = logs.map((log) => [
      formatWhen(log.createdAt),
      log.userEmail ?? "",
      log.userName ?? "",
      log.ipAddress ?? "",
      log.pageUrl,
      deviceOf(log.userAgent),
      log.referrer ?? "",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `site-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const purge = async () => {
    if (!confirm("Delete tracking logs older than 30 days?")) return;
    await fetch("/api/admin/logs?days=30", { method: "DELETE", credentials: "same-origin" });
    await load();
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cards = useMemo(
    () => [
      { label: "Total page views", value: stats?.total ?? 0, icon: FiEye },
      { label: "Views today", value: stats?.today ?? 0, icon: FiActivity },
      { label: "Unique visitors", value: stats?.uniqueVisitors ?? 0, icon: FiUsers },
    ],
    [stats],
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-[#e5e8ef] bg-white p-5">
            <div className="flex items-center gap-2 text-[#0f4c81]">
              <Icon />
              <p className="text-[10px] font-black tracking-[.14em]">{label.toUpperCase()}</p>
            </div>
            <p className="mt-3 text-3xl font-black text-[#0f172a]">{value.toLocaleString("en-IN")}</p>
          </div>
        ))}
      </div>

      {stats?.topPages?.length ? (
        <div className="rounded-xl border border-[#e5e8ef] bg-white p-5">
          <p className="text-[10px] font-black tracking-[.14em] text-[#0f4c81]">MOST VISITED PAGES</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.topPages.map((item) => (
              <span key={item.pageUrl} className="rounded-lg bg-[#f1f5fb] px-3 py-1.5 text-xs font-bold text-[#334155]">
                {item.pageUrl} <span className="text-[#0f4c81]">· {item.views}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[#e5e8ef] bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#e5e8ef] p-4">
          <div className="flex items-center gap-2 rounded-lg border border-[#dbe2ec] px-3 py-2">
            <FiSearch className="text-[#94a3b8]" />
            <input
              value={emailFilter}
              onChange={(event) => {
                setPage(0);
                setEmailFilter(event.target.value);
              }}
              placeholder="Filter by email"
              className="w-40 text-xs outline-none"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[#dbe2ec] px-3 py-2">
            <FiSearch className="text-[#94a3b8]" />
            <input
              value={pathFilter}
              onChange={(event) => {
                setPage(0);
                setPathFilter(event.target.value);
              }}
              placeholder="Filter by page"
              className="w-40 text-xs outline-none"
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-[#64748b]">
            <input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />
            Auto refresh (15s)
          </label>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={load} className="inline-flex items-center gap-1 rounded border border-[#dbe2ec] px-3 py-2 text-[10px] font-black text-[#64748b]">
              <FiRefreshCw className={loading ? "animate-spin" : ""} /> REFRESH
            </button>
            <button onClick={exportCsv} className="inline-flex items-center gap-1 rounded border border-[#dbe2ec] px-3 py-2 text-[10px] font-black text-[#64748b]">
              <FiDownload /> CSV
            </button>
            <button onClick={purge} className="inline-flex items-center gap-1 rounded border border-red-200 px-3 py-2 text-[10px] font-black text-red-600">
              <FiTrash2 /> PURGE 30d+
            </button>
          </div>
        </div>

        {error ? (
          <p className="p-9 text-center text-sm font-bold text-red-600">{error}</p>
        ) : logs.length === 0 ? (
          <p className="p-9 text-center text-sm text-[#64748b]">
            {loading ? "Loading visitor logs…" : "No page views logged yet."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[#f8fafc] text-[10px] font-black uppercase tracking-[.1em] text-[#64748b]">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">IP address</th>
                  <th className="px-4 py-3">Page URL</th>
                  <th className="px-4 py-3">Device</th>
                  <th className="px-4 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef1f6]">
                {logs.map((log, index) => (
                  <tr key={log.id} className="hover:bg-[#f8fafc]">
                    <td className="px-4 py-3 text-xs text-[#94a3b8]">{page * PAGE_SIZE + index + 1}</td>
                    <td className="px-4 py-3 font-bold text-[#0f172a]">{log.userName ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-[#334155]">{log.userEmail ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#334155]">{log.ipAddress ?? "—"}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-[#0f4c81]">{log.pageUrl}</td>
                    <td className="px-4 py-3 text-xs text-[#64748b]">{deviceOf(log.userAgent)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-[#64748b]">{formatWhen(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[#e5e8ef] p-4 text-xs font-bold text-[#64748b]">
          <span>
            {total.toLocaleString("en-IN")} total rows · page {page + 1} of {pages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              className="rounded border border-[#dbe2ec] px-3 py-1.5 disabled:opacity-40"
            >
              PREV
            </button>
            <button
              disabled={page + 1 >= pages}
              onClick={() => setPage((value) => value + 1)}
              className="rounded border border-[#dbe2ec] px-3 py-1.5 disabled:opacity-40"
            >
              NEXT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
