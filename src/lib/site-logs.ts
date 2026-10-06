import { db } from "@/db";
import { siteLogs } from "@/db/schema";
import { and, desc, ilike, sql, type SQL } from "drizzle-orm";
import { ensureAuthTables } from "@/lib/auth-tables";

export type SiteLogRow = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  ipAddress: string | null;
  pageUrl: string;
  referrer: string | null;
  userAgent: string | null;
  country: string | null;
  city: string | null;
  createdAt: string | Date;
};

export type RecordVisitInput = {
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  ipAddress?: string | null;
  pageUrl: string;
  referrer?: string | null;
  userAgent?: string | null;
  country?: string | null;
  city?: string | null;
};

const trim = (value: string | null | undefined, max: number): string | null => {
  if (!value) return null;
  const clean = String(value).trim();
  return clean ? clean.slice(0, max) : null;
};

/**
 * Append one page-view row. Tracking is telemetry: it must never throw
 * and never block the user's request.
 */
export async function recordVisit(input: RecordVisitInput): Promise<boolean> {
  const pageUrl = trim(input.pageUrl, 1000);
  if (!pageUrl) return false;

  const ready = await ensureAuthTables();
  if (!ready) return false;

  try {
    await db.insert(siteLogs).values({
      userId: input.userId && /^[0-9a-f-]{36}$/i.test(input.userId) ? input.userId : null,
      userEmail: trim(input.userEmail, 180),
      userName: trim(input.userName, 120),
      ipAddress: trim(input.ipAddress, 64),
      pageUrl,
      referrer: trim(input.referrer, 1000),
      userAgent: trim(input.userAgent, 500),
      country: trim(input.country, 120),
      city: trim(input.city, 120),
    });
    return true;
  } catch {
    return false;
  }
}

export type LogQuery = {
  limit?: number;
  offset?: number;
  email?: string | null;
  path?: string | null;
};

/** Paginated log listing for the admin panel. */
export async function listSiteLogs(query: LogQuery = {}): Promise<{ logs: SiteLogRow[]; total: number }> {
  const ready = await ensureAuthTables();
  if (!ready) return { logs: [], total: 0 };

  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 500);
  const offset = Math.max(Number(query.offset) || 0, 0);

  const filters: SQL[] = [];
  if (query.email) filters.push(ilike(siteLogs.userEmail, `%${query.email}%`));
  if (query.path) filters.push(ilike(siteLogs.pageUrl, `%${query.path}%`));
  const where = filters.length ? and(...filters) : undefined;

  try {
    const logs = (await db
      .select()
      .from(siteLogs)
      .where(where)
      .orderBy(desc(siteLogs.createdAt))
      .limit(limit)
      .offset(offset)) as SiteLogRow[];

    const [{ value }] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(siteLogs)
      .where(where);

    return { logs, total: Number(value) || 0 };
  } catch {
    return { logs: [], total: 0 };
  }
}

/** Headline numbers shown above the admin log table. */
export async function getLogStats(): Promise<{
  total: number;
  today: number;
  uniqueVisitors: number;
  topPages: { pageUrl: string; views: number }[];
}> {
  const ready = await ensureAuthTables();
  if (!ready) return { total: 0, today: 0, uniqueVisitors: 0, topPages: [] };

  try {
    const [[totals], top] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          today: sql<number>`count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int`,
          uniqueVisitors: sql<number>`count(DISTINCT user_email)::int`,
        })
        .from(siteLogs),
      db
        .select({ pageUrl: siteLogs.pageUrl, views: sql<number>`count(*)::int` })
        .from(siteLogs)
        .groupBy(siteLogs.pageUrl)
        .orderBy(sql`count(*) DESC`)
        .limit(8),
    ]);

    return {
      total: Number(totals?.total) || 0,
      today: Number(totals?.today) || 0,
      uniqueVisitors: Number(totals?.uniqueVisitors) || 0,
      topPages: top.map((row) => ({ pageUrl: row.pageUrl, views: Number(row.views) || 0 })),
    };
  } catch {
    return { total: 0, today: 0, uniqueVisitors: 0, topPages: [] };
  }
}

/** Housekeeping: delete logs older than N days (admin action). */
export async function purgeLogsOlderThan(days: number): Promise<number> {
  const ready = await ensureAuthTables();
  if (!ready) return 0;
  const safeDays = Math.max(0, Math.floor(days));
  try {
    if (safeDays === 0) {
      const result = await db.delete(siteLogs);
      return (result as unknown as { rowCount?: number }).rowCount ?? 0;
    }
    const result = await db
      .delete(siteLogs)
      .where(sql`${siteLogs.createdAt} < now() - make_interval(days => ${safeDays})`);
    return (result as unknown as { rowCount?: number }).rowCount ?? 0;
  } catch {
    return 0;
  }
}
