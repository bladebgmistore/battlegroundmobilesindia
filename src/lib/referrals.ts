import { db } from "@/db";
import { pointRedemptions, referralCommissions, users } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { ensureReferralTables } from "@/lib/referral-tables";
import {
  REFERRAL_COMMISSION_PERCENT,
  generateReferralCode,
  maskEmail,
  normalizeReferralCode,
} from "@/lib/referral-config";
import { isUniqueViolation, rowsOf } from "@/lib/sql-rows";

/**
 * Refer & Earn — server logic.
 *
 * Business rules
 *  - Every account gets a unique referral code at signup (lazily for older accounts).
 *  - A new account that signs up through a referral link gets `referred_by` = referrer.id.
 *  - When an order of a referred user reaches `payment_confirmed` or `delivered`,
 *    the referrer earns 20% of the amount paid, in points (1 point = ₹1).
 *  - If that order is later cancelled, moved back, or deleted, the commission is reversed.
 *
 * Idempotency: `syncReferralCommissions()` is the single place that moves points.
 * It only inserts or flips ledger rows that need it (unique `order_id` + a
 * conditional status check), so calling it repeatedly never double-credits.
 */

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Random code that no other user holds yet. Throws only if the database is unreachable. */
export async function generateUniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateReferralCode();
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.referralCode, code)).limit(1);
    if (!taken) return code;
  }
  throw new Error("Could not allocate a unique referral code.");
}

/** users.id of the account that owns this referral code, or null. */
export async function findReferrerIdByCode(code: string | null | undefined): Promise<string | null> {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  try {
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.referralCode, normalized)).limit(1);
    return row?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Return the user's referral code, generating and storing one if the account
 * predates the feature. The conditional UPDATE makes concurrent calls safe.
 */
export async function ensureReferralCode(userId: string): Promise<string | null> {
  if (!isUuid(userId)) return null;

  const [current] = await db.select({ code: users.referralCode }).from(users).where(eq(users.id, userId)).limit(1);
  if (!current) return null;
  if (current.code) return current.code;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = generateReferralCode();
    try {
      const [updated] = await db
        .update(users)
        .set({ referralCode: candidate, updatedAt: new Date() })
        .where(sql`${users.id} = ${userId}::uuid AND ${users.referralCode} IS NULL`)
        .returning({ code: users.referralCode });
      if (updated?.code) return updated.code;

      // Another request set the code first — return that one.
      const [again] = await db.select({ code: users.referralCode }).from(users).where(eq(users.id, userId)).limit(1);
      return again?.code ?? null;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error; // collision with another user's code → try again
    }
  }
  return null;
}

/**
 * Reconcile commission ledger entries with the orders they belong to.
 * Pass `orderId` to limit the work to one order (used right after a status change).
 */
export async function syncReferralCommissions(options: { orderId?: string } = {}): Promise<boolean> {
  const ready = await ensureReferralTables();
  if (!ready) return false;

  const orderId = options.orderId ?? null;
  if (orderId && !isUuid(orderId)) return false;

  const reverseScope = orderId ? sql`AND rc.order_id = ${orderId}::uuid` : sql``;
  const creditScope = orderId ? sql`AND o.id = ${orderId}::uuid` : sql``;
  const percent = REFERRAL_COMMISSION_PERCENT;

  // 1) Reverse credits whose order is no longer confirmed (cancelled, moved back, or deleted).
  await db.execute(sql`
    WITH reversed AS (
      UPDATE referral_commissions rc
      SET status = 'reversed', reversed_at = now()
      WHERE rc.status = 'credited' ${reverseScope}
        AND NOT EXISTS (
          SELECT 1 FROM orders o
          WHERE o.id = rc.order_id
            AND o.status IN ('payment_confirmed', 'delivered')
            AND o.commissionable
        )
      RETURNING rc.referrer_id, rc.points
    )
    UPDATE users u
    SET points_balance = u.points_balance - t.total, updated_at = now()
    FROM (SELECT referrer_id, SUM(points)::int AS total FROM reversed GROUP BY referrer_id) t
    WHERE u.id = t.referrer_id
  `);

  // 2) Credit every confirmed purchase made by a referred user that has no active credit.
  //    A previously reversed row is flipped back to credited (order re-confirmed).
  await db.execute(sql`
    WITH eligible AS (
      SELECT o.id AS order_id,
             o.order_code,
             o.amount,
             o.user_id AS referred_user_id,
             u.referred_by AS referrer_id
      FROM orders o
      JOIN users u ON u.id = o.user_id
      WHERE o.status IN ('payment_confirmed', 'delivered')
        AND o.commissionable
        AND o.amount > 0
        AND u.referred_by IS NOT NULL
        AND u.referred_by <> u.id
        ${creditScope}
    ),
    credited AS (
      INSERT INTO referral_commissions
        (referrer_id, referred_user_id, order_id, order_code, purchase_amount, commission_percent, points, status)
      SELECT e.referrer_id,
             e.referred_user_id,
             e.order_id,
             e.order_code,
             e.amount,
             ${percent}::int,
             FLOOR(e.amount * ${percent}::int / 100)::int,
             'credited'
      FROM eligible e
      ON CONFLICT (order_id) DO UPDATE
        SET status = 'credited',
            reversed_at = NULL,
            referrer_id = EXCLUDED.referrer_id,
            referred_user_id = EXCLUDED.referred_user_id,
            purchase_amount = EXCLUDED.purchase_amount,
            commission_percent = EXCLUDED.commission_percent,
            points = EXCLUDED.points
        WHERE referral_commissions.status = 'reversed'
      RETURNING referrer_id, points
    )
    UPDATE users u
    SET points_balance = u.points_balance + t.total, updated_at = now()
    FROM (SELECT referrer_id, SUM(points)::int AS total FROM credited GROUP BY referrer_id) t
    WHERE u.id = t.referrer_id
  `);

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Read models
// ─────────────────────────────────────────────────────────────────────────────

export type ReferralStats = {
  totalReferrals: number;
  purchasingReferrals: number;
  totalEarnedPoints: number;
  availablePoints: number;
  redeemedPoints: number;
  commissionPercent: number;
};

export type ReferredFriend = {
  id: string;
  name: string;
  maskedEmail: string;
  joinedAt: string | null;
  purchases: number;
  earnedPoints: number;
};

export type ReferralHistoryItem = {
  id: string;
  kind: "commission" | "redemption";
  title: string;
  detail: string;
  /** Signed points that are currently in effect: +earned, −spent, 0 when reversed or refunded. */
  points: number;
  status: string;
  createdAt: string;
};

export type ReferralDashboard = {
  referralCode: string | null;
  stats: ReferralStats;
  referrals: ReferredFriend[];
  history: ReferralHistoryItem[];
};

const iso = (value: unknown): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** Everything the Refer & Earn dashboard needs for one user. Returns null if the database is offline. */
export async function getReferralDashboard(userId: string): Promise<ReferralDashboard | null> {
  const ready = await ensureReferralTables();
  if (!ready || !isUuid(userId)) return null;

  const referralCode = await ensureReferralCode(userId);

  const [totals] = rowsOf<Record<string, number | null>>(
    await db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM users WHERE referred_by = ${userId}::uuid) AS total_referrals,
        (SELECT COUNT(DISTINCT referred_user_id)::int FROM referral_commissions
           WHERE referrer_id = ${userId}::uuid AND status = 'credited') AS purchasing_referrals,
        (SELECT COALESCE(SUM(points), 0)::int FROM referral_commissions
           WHERE referrer_id = ${userId}::uuid AND status = 'credited') AS total_earned,
        (SELECT COALESCE(SUM(points_cost), 0)::int FROM point_redemptions
           WHERE user_id = ${userId}::uuid AND status <> 'rejected') AS total_redeemed,
        (SELECT points_balance FROM users WHERE id = ${userId}::uuid) AS available
    `),
  );

  const friendRows = rowsOf<{
    id: string;
    name: string;
    email: string | null;
    joined_at: unknown;
    purchases: number;
    earned_points: number;
  }>(
    await db.execute(sql`
      SELECT u.id, u.name, u.email, u.created_at AS joined_at,
             COALESCE(c.purchases, 0)::int AS purchases,
             COALESCE(c.points, 0)::int AS earned_points
      FROM users u
      LEFT JOIN (
        SELECT referred_user_id, COUNT(*) AS purchases, SUM(points) AS points
        FROM referral_commissions
        WHERE referrer_id = ${userId}::uuid AND status = 'credited'
        GROUP BY referred_user_id
      ) c ON c.referred_user_id = u.id
      WHERE u.referred_by = ${userId}::uuid
      ORDER BY u.created_at DESC
      LIMIT 200
    `),
  );

  const commissions = await db
    .select({
      id: referralCommissions.id,
      orderCode: referralCommissions.orderCode,
      purchaseAmount: referralCommissions.purchaseAmount,
      commissionPercent: referralCommissions.commissionPercent,
      points: referralCommissions.points,
      status: referralCommissions.status,
      createdAt: referralCommissions.createdAt,
      buyerName: users.name,
    })
    .from(referralCommissions)
    .leftJoin(users, eq(users.id, referralCommissions.referredUserId))
    .where(eq(referralCommissions.referrerId, userId))
    .orderBy(desc(referralCommissions.createdAt))
    .limit(50);

  const redemptions = await db
    .select()
    .from(pointRedemptions)
    .where(eq(pointRedemptions.userId, userId))
    .orderBy(desc(pointRedemptions.createdAt))
    .limit(50);

  const history: ReferralHistoryItem[] = [
    ...commissions.map((row) => {
      const reversed = row.status === "reversed";
      return {
        id: row.id,
        kind: "commission" as const,
        title: `Referral commission · ${row.buyerName ?? "Friend"}`,
        detail: `Order #${row.orderCode} · ₹${row.purchaseAmount} × ${row.commissionPercent}%${reversed ? " · order cancelled" : ""}`,
        points: reversed ? 0 : row.points,
        status: reversed ? "reversed" : "credited",
        createdAt: iso(row.createdAt) ?? new Date(0).toISOString(),
      };
    }),
    ...redemptions.map((row) => ({
      id: row.id,
      kind: "redemption" as const,
      title: `Redeemed · ${row.rewardTitle}`,
      detail: `${row.ucAmount.toLocaleString("en-IN")} UC → UID ${row.playerUid}${row.adminNote ? ` · ${row.adminNote}` : ""}`,
      points: row.status === "rejected" ? 0 : -row.pointsCost,
      status: row.status,
      createdAt: iso(row.createdAt) ?? new Date(0).toISOString(),
    })),
  ]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 60);

  return {
    referralCode,
    stats: {
      totalReferrals: Number(totals?.total_referrals) || 0,
      purchasingReferrals: Number(totals?.purchasing_referrals) || 0,
      totalEarnedPoints: Number(totals?.total_earned) || 0,
      availablePoints: Number(totals?.available) || 0,
      redeemedPoints: Number(totals?.total_redeemed) || 0,
      commissionPercent: REFERRAL_COMMISSION_PERCENT,
    },
    referrals: friendRows.map((row) => ({
      id: row.id,
      name: row.name,
      maskedEmail: maskEmail(row.email),
      joinedAt: iso(row.joined_at),
      purchases: Number(row.purchases) || 0,
      earnedPoints: Number(row.earned_points) || 0,
    })),
    history,
  };
}

export type AdminReferralOverview = {
  stats: {
    totalUsers: number;
    referredUsers: number;
    activeReferrers: number;
    creditedPoints: number;
    referredSales: number;
  };
  referrals: Array<{
    referredId: string;
    referredName: string;
    referredEmail: string;
    joinedAt: string | null;
    referrerId: string;
    referrerName: string;
    referrerEmail: string;
    referrerCode: string | null;
    purchases: number;
    earnedPoints: number;
  }>;
  commissions: Array<{
    id: string;
    orderCode: string;
    purchaseAmount: number;
    commissionPercent: number;
    points: number;
    status: string;
    createdAt: string | null;
    reversedAt: string | null;
    referrerName: string;
    referrerEmail: string;
    buyerName: string;
    buyerEmail: string;
  }>;
};

/** Admin view: referral tree, commission ledger and headline numbers. Syncs first so the numbers are current. */
export async function getAdminReferralOverview(): Promise<AdminReferralOverview | null> {
  const ready = await ensureReferralTables();
  if (!ready) return null;
  await syncReferralCommissions();

  const [stats] = rowsOf<Record<string, number | null>>(
    await db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS total_users,
        (SELECT COUNT(*)::int FROM users WHERE referred_by IS NOT NULL) AS referred_users,
        (SELECT COUNT(DISTINCT referrer_id)::int FROM referral_commissions WHERE status = 'credited') AS active_referrers,
        (SELECT COALESCE(SUM(points), 0)::int FROM referral_commissions WHERE status = 'credited') AS credited_points,
        (SELECT COALESCE(SUM(purchase_amount), 0)::int FROM referral_commissions WHERE status = 'credited') AS referred_sales
    `),
  );

  const referralRows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      SELECT u.id AS referred_id, u.name AS referred_name, u.email AS referred_email, u.created_at AS joined_at,
             r.id AS referrer_id, r.name AS referrer_name, r.email AS referrer_email, r.referral_code AS referrer_code,
             COALESCE(c.purchases, 0)::int AS purchases,
             COALESCE(c.points, 0)::int AS earned_points
      FROM users u
      JOIN users r ON r.id = u.referred_by
      LEFT JOIN (
        SELECT referred_user_id, COUNT(*) AS purchases, SUM(points) AS points
        FROM referral_commissions WHERE status = 'credited'
        GROUP BY referred_user_id
      ) c ON c.referred_user_id = u.id
      ORDER BY u.created_at DESC
      LIMIT 300
    `),
  );

  const commissionRows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      SELECT rc.id, rc.order_code, rc.purchase_amount, rc.commission_percent, rc.points, rc.status,
             rc.created_at, rc.reversed_at,
             r.name AS referrer_name, r.email AS referrer_email,
             b.name AS buyer_name, b.email AS buyer_email
      FROM referral_commissions rc
      LEFT JOIN users r ON r.id = rc.referrer_id
      LEFT JOIN users b ON b.id = rc.referred_user_id
      ORDER BY rc.created_at DESC
      LIMIT 300
    `),
  );

  return {
    stats: {
      totalUsers: Number(stats?.total_users) || 0,
      referredUsers: Number(stats?.referred_users) || 0,
      activeReferrers: Number(stats?.active_referrers) || 0,
      creditedPoints: Number(stats?.credited_points) || 0,
      referredSales: Number(stats?.referred_sales) || 0,
    },
    referrals: referralRows.map((row) => ({
      referredId: String(row.referred_id),
      referredName: String(row.referred_name ?? ""),
      referredEmail: String(row.referred_email ?? ""),
      joinedAt: iso(row.joined_at),
      referrerId: String(row.referrer_id),
      referrerName: String(row.referrer_name ?? ""),
      referrerEmail: String(row.referrer_email ?? ""),
      referrerCode: row.referrer_code ? String(row.referrer_code) : null,
      purchases: Number(row.purchases) || 0,
      earnedPoints: Number(row.earned_points) || 0,
    })),
    commissions: commissionRows.map((row) => ({
      id: String(row.id),
      orderCode: String(row.order_code ?? ""),
      purchaseAmount: Number(row.purchase_amount) || 0,
      commissionPercent: Number(row.commission_percent) || 0,
      points: Number(row.points) || 0,
      status: String(row.status ?? ""),
      createdAt: iso(row.created_at),
      reversedAt: iso(row.reversed_at),
      referrerName: String(row.referrer_name ?? ""),
      referrerEmail: String(row.referrer_email ?? ""),
      buyerName: String(row.buyer_name ?? ""),
      buyerEmail: String(row.buyer_email ?? ""),
    })),
  };
}
