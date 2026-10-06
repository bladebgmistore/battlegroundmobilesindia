import { NextResponse, type NextRequest } from "next/server";
import { requireScopeApi } from "@/lib/auth";
import { getLogStats, listSiteLogs, purgeLogsOlderThan } from "@/lib/site-logs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Owner/admin only: paginated visitor logs + headline stats. */
export async function GET(request: NextRequest) {
  const guard = await requireScopeApi(request, "logs");
  if (guard.error) return guard.error;

  const params = request.nextUrl.searchParams;
  const [{ logs, total }, stats] = await Promise.all([
    listSiteLogs({
      limit: Number(params.get("limit") ?? 100),
      offset: Number(params.get("offset") ?? 0),
      email: params.get("email"),
      path: params.get("path"),
    }),
    getLogStats(),
  ]);

  return NextResponse.json({ ok: true, logs, total, stats }, { headers: { "Cache-Control": "no-store" } });
}

/** Owner/admin housekeeping: `?days=30` keeps the last 30 days, `?days=0` wipes all. */
export async function DELETE(request: NextRequest) {
  const guard = await requireScopeApi(request, "logs");
  if (guard.error) return guard.error;

  const days = Number(request.nextUrl.searchParams.get("days") ?? 30);
  const deleted = await purgeLogsOlderThan(Number.isFinite(days) ? days : 30);
  return NextResponse.json({ ok: true, deleted });
}
