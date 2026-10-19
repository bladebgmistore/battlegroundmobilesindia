import { db1, db3 } from "@/db";
import { orders, pointRedemptions, referralCommissions, users } from "@/db/schema";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { ensureReferralTables } from "@/lib/referral-tables";
import {
  REFERRAL_COMMISSION_PERCENT,
  generateReferralCode,
  maskEmail,
  normalizeReferralCode,
} from "@/lib/referral-config";
import { isUniqueViolation, rowsOf } from "@/lib/sql-rows";

/**
 * Refer & Earn — server logic across the 3-database split.
 *
 *  DB1 (users)              → referral codes, `referred_by`, `points_balance`
 *  DB3 (orders + ledger)    → orders, referral_commissions, point_redemptions
 *
 * Business rules
 *  - Every account gets a unique referral code when created (lazily for older accounts).
 *  - A new account created after following a referral link gets `referred_by` = referrer.id.
 *  - When an order of a referred user reaches `payment_confirmed` or `delivered`,
 *    the referrer earns 20% of the amount paid, in points (1 point = ₹1).
 *  - If that order is later cancelled, moved back, or deleted, the commission is reversed.
 *
 * Because the points balance lives in DB1 and the ledger lives in DB3, the
 * cross-database work is done at the application level (batched reads + a
 * small reconciliation loop) instead of a single SQL JOIN/CTE. Each ledger
 * transition is conditional on the row's current status, so calling
 * `syncReferralCommissions()` repeatedly is still idempotent.
 */

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/* -------------------------------------------------------------------------- */
/*  DB1 — referral codes                                                      */
/* -------------------------------------------------------------------------- */

/** Random code that no other user holds yet. Throws only if the database is unreachable. */
export async function generateUniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateReferralCode();
    const [taken] = await db1.select({ id: users.id }).from(users).where(eq(users.referralCode, code)).limit(1);
    if (!taken) return code;
  }
  throw new Error("Could not allocate a unique referral code.");
}

/** users.id of the account that owns this referral code, or null. */
export async function findReferrerIdByCode(code: string | null | undefined): Promise<string | null> {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  try {
    const [row] = await db1.select({ id: users.id }).from(users).where(eq(users.referralCode, normalized)).limit(1);
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

  const [current] = await db1.select({ code: users.referralCode }).from(users).where(eq(users.id, userId)).limit(1);
  if (!current) return null;
  if (current.code) return current.code;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = generateReferralCode();
    try {
      const [updated] = await db1.update(users)
        .set({ referralCode: candidate, updatedAt: new Date() })
        .where(sql`${users.id} = ${userId}::uuid AND ${users.referralCode} IS NULL`)
        .returning({ code: users.referralCode });
      if (updated?.code) return updated.code;

      // Another request set the code first — return that one.
      const [again] = await db1.select({ code: users.referralCode }).from(users).where(eq(users.id, userId)).limit(1);
      return again?.code ?? null;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error; // collision with another user's code → try again
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Reconciliation — DB3 ledger ↔ DB1 balances                                */
/* -------------------------------------------------------------------------- */

/** Add `delta` points to a user's balance in DB1 (negative values subtract). */
async function adjustPointsBalance(userId: string, delta: number): Promise<void> {
  if (!delta) return;
  await db1.execute(sql`
    UPDATE users
    SET points_balance = points_balance + ${delta}::int, updated_at = now()
    WHERE id = ${userId}::uuid
  `);
}

/**
 * Reconcile commission ledger entries with the orders they belong to.
 * Pass `orderId` to limit the work to one order (used right after a status change).
 */
export async function syncReferralCommissions(options: { orderId?: string } = {}): Promise<boolean> {
  const ready = await ensureReferralTables();
  if (!ready) return false;

  const scopedOrderId = options.orderId ?? null;
  if (scopedOrderId && !isUuid(scopedOrderId)) return false;

  try {
    const percent = REFERRAL_COMMISSION_PERCENT;

    // 1) Every order that legitimately earns a commission (DB3).
    const confirmedOrders = await db3.select({
        id: orders.id,
        orderCode: orders.orderCode,
        userId: orders.userId,
        amount: orders.amount,
      })
      .from(orders)
      .where(
        and(
          inArray(orders.status, ["payment_confirmed", "delivered"]),
          eq(orders.commissionable, true),
          gt(orders.amount, 0),
          scopedOrderId ? eq(orders.id, scopedOrderId) : undefined,
        ),
      );
    const confirmedById = new Map(confirmedOrders.map((order) => [order.id, order]));

    // 2) Current ledger rows (DB3).
    const existing = await db3.select()
      .from(referralCommissions)
      .where(scopedOrderId ? eq(referralCommissions.orderId, scopedOrderId) : undefined);
    const existingByOrder = new Map(existing.map((row) => [row.orderId, row]));

    // 3) Which buyer was referred by whom (DB1).
    const buyerIds = [
      ...new Set(
        [...confirmedOrders.map((order) => order.userId), ...existing.map((row) => row.referredUserId)].filter(isUuid),
      ),
    ];
    const buyerRows = buyerIds.length
      ? await db1.select({ id: users.id, referredBy: users.referredBy }).from(users).where(inArray(users.id, buyerIds))
      : [];
    const referrerByBuyer = new Map(buyerRows.map((row) => [row.id, row.referredBy]));

    // 4) Reverse credits whose order is no longer confirmed (cancelled, moved back, or deleted).
    for (const row of existing) {
      if (row.status !== "credited") continue;
      if (confirmedById.has(row.orderId)) continue;
      await db3.update(referralCommissions)
        .set({ status: "reversed", reversedAt: new Date() })
        .where(and(eq(referralCommissions.id, row.id), eq(referralCommissions.status, "credited")));
      await adjustPointsBalance(row.referrerId, -row.points);
    }

    // 5) Credit (or refresh) every confirmed purchase made by a referred user.
    for (const order of confirmedOrders) {
      if (!isUuid(order.userId)) continue;
      const referrerId = referrerByBuyer.get(order.userId);
      if (!referrerId || referrerId === order.userId || !isUuid(referrerId)) continue;

      const points = Math.floor((order.amount * percent) / 100);
      if (points <= 0) continue;

      const previous = existingByOrder.get(order.id);
      // Already credited with the same figures — nothing to move.
      if (
        previous &&
        previous.status === "credited" &&
        previous.points === points &&
        previous.referrerId === referrerId
      ) {
        continue;
      }

      const [ledgerRow] = await db3.insert(referralCommissions)
        .values({
          referrerId,
          referredUserId: order.userId,
          orderId: order.id,
          orderCode: order.orderCode,
          purchaseAmount: order.amount,
          commissionPercent: percent,
          points,
          status: "credited",
        })
        .onConflictDoUpdate({
          target: referralCommissions.orderId,
          set: {
            status: "credited",
            reversedAt: null,
            referrerId,
            referredUserId: order.userId,
            purchaseAmount: order.amount,
            commissionPercent: percent,
            points,
          },
        })
        .returning();

      if (!ledgerRow) continue;
      // Only the incremental delta is moved into the buyer's referrer balance:
      // a reversed row has already been subtracted, so it now adds in full.
      const alreadyCredited = previous?.status === "credited" ? previous.points : 0;
      await adjustPointsBalance(referrerId, ledgerRow.points - alreadyCredited);
    }

    return true;
  } catch (error) {
    console.error("Referral commission sync failed:", error);
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*  Read models                                                               */
/* -------------------------------------------------------------------------- */

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

  // DB1 — the buyer's profile + spendable balance.
  const [profile] = await db1.select({ id: users.id, name: users.name, email: users.email, pointsBalance: users.pointsBalance })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!profile) return null;

  const referralCode = await ensureReferralCode(userId).catch(() => null);

  // DB3 — the commission ledger + redemption history.
  const [commissions, redemptions] = await Promise.all([
    db3.select()
      .from(referralCommissions)
      .where(eq(referralCommissions.referrerId, userId))
      .orderBy(desc(referralCommissions.createdAt))
      .limit(200),
    db3.select()
      .from(pointRedemptions)
      .where(eq(pointRedemptions.userId, userId))
      .orderBy(desc(pointRedemptions.createdAt))
      .limit(50),
  ]);

  // DB1 — accounts this user referred.
  const friends = await db1.select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.referredBy, userId))
    .orderBy(desc(users.createdAt))
    .limit(200);
  const friendById = new Map(friends.map((friend) => [friend.id, friend]));

  const credited = commissions.filter((row) => row.status === "credited");
  const earnedByFriend = new Map<string, number>();
  const purchasesByFriend = new Map<string, number>();
  for (const row of credited) {
    earnedByFriend.set(row.referredUserId, (earnedByFriend.get(row.referredUserId) ?? 0) + row.points);
    purchasesByFriend.set(row.referredUserId, (purchasesByFriend.get(row.referredUserId) ?? 0) + 1);
  }

  const history: ReferralHistoryItem[] = [
    ...commissions.map((row) => {
      const reversed = row.status === "reversed";
      return {
        id: row.id,
        kind: "commission" as const,
        title: `Referral commission · ${friendById.get(row.referredUserId)?.name ?? "Friend"}`,
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
      totalReferrals: friends.length,
      purchasingReferrals: new Set(credited.map((row) => row.referredUserId)).size,
      totalEarnedPoints: credited.reduce((sum, row) => sum + row.points, 0),
      availablePoints: profile.pointsBalance,
      redeemedPoints: redemptions
        .filter((row) => row.status !== "rejected")
        .reduce((sum, row) => sum + row.pointsCost, 0),
      commissionPercent: REFERRAL_COMMISSION_PERCENT,
    },
    referrals: friends.map((friend) => ({
      id: friend.id,
      name: friend.name,
      maskedEmail: maskEmail(friend.email),
      joinedAt: iso(friend.createdAt),
      purchases: purchasesByFriend.get(friend.id) ?? 0,
      earnedPoints: earnedByFriend.get(friend.id) ?? 0,
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

  // DB1 — everyone (for the referral tree and name lookups).
  const allUsers = await db1.select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
      referralCode: users.referralCode,
      referredBy: users.referredBy,
    })
    .from(users)
    .limit(2000);
  const userById = new Map(allUsers.map((user) => [user.id, user]));

  // DB1 — exact headline counts (the 2,000-row list above is only for names).
  const [userCounts] = rowsOf<{ total_users: number; referred_users: number }>(
    await db1.execute(sql`
      SELECT COUNT(*)::int AS total_users,
             COUNT(*) FILTER (WHERE referred_by IS NOT NULL)::int AS referred_users
      FROM users
    `),
  );

  // DB3 — ledger aggregate + latest rows.
  const [aggregate] = rowsOf<{ active_referrers: number; credited_points: number; referred_sales: number }>(
    await db3.execute(sql`
      SELECT COUNT(DISTINCT referrer_id)::int AS active_referrers,
             COALESCE(SUM(points), 0)::int AS credited_points,
             COALESCE(SUM(purchase_amount), 0)::int AS referred_sales
      FROM referral_commissions
      WHERE status = 'credited'
    `),
  );

  const commissionRows = await db3.select()
    .from(referralCommissions)
    .orderBy(desc(referralCommissions.createdAt))
    .limit(300);

  // Purchases / points per referred user (from the credited ledger rows).
  const purchasesByFriend = new Map<string, number>();
  const earnedByFriend = new Map<string, number>();
  for (const row of commissionRows) {
    if (row.status !== "credited") continue;
    purchasesByFriend.set(row.referredUserId, (purchasesByFriend.get(row.referredUserId) ?? 0) + 1);
    earnedByFriend.set(row.referredUserId, (earnedByFriend.get(row.referredUserId) ?? 0) + row.points);
  }

  const referredUsers = allUsers.filter((user) => isUuid(user.referredBy));

  return {
    stats: {
      totalUsers: Number(userCounts?.total_users) || 0,
      referredUsers: Number(userCounts?.referred_users) || 0,
      activeReferrers: Number(aggregate?.active_referrers) || 0,
      creditedPoints: Number(aggregate?.credited_points) || 0,
      referredSales: Number(aggregate?.referred_sales) || 0,
    },
    referrals: referredUsers.map((user) => {
      const referrer = user.referredBy ? userById.get(user.referredBy) : undefined;
      return {
        referredId: user.id,
        referredName: user.name,
        referredEmail: user.email ?? "",
        joinedAt: iso(user.createdAt),
        referrerId: referrer?.id ?? user.referredBy ?? "",
        referrerName: referrer?.name ?? "",
        referrerEmail: referrer?.email ?? "",
        referrerCode: referrer?.referralCode ?? null,
        purchases: purchasesByFriend.get(user.id) ?? 0,
        earnedPoints: earnedByFriend.get(user.id) ?? 0,
      };
    }),
    commissions: commissionRows.map((row) => {
      const referrer = userById.get(row.referrerId);
      const buyer = userById.get(row.referredUserId);
      return {
        id: row.id,
        orderCode: row.orderCode,
        purchaseAmount: row.purchaseAmount,
        commissionPercent: row.commissionPercent,
        points: row.points,
        status: row.status,
        createdAt: iso(row.createdAt),
        reversedAt: iso(row.reversedAt),
        referrerName: referrer?.name ?? "",
        referrerEmail: referrer?.email ?? "",
        buyerName: buyer?.name ?? "",
        buyerEmail: buyer?.email ?? "",
      };
    }),
  };
}
