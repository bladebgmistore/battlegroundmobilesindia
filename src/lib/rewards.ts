import { db1, db3 } from "@/db";
import { pointRedemptions, rewardItems, users } from "@/db/schema";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { ensureReferralTables } from "@/lib/referral-tables";
import { isUuid } from "@/lib/referrals";
import { rowsOf } from "@/lib/sql-rows";

/**
 * Points Store — reward catalogue, redemptions and their admin workflow.
 *
 * Money-safety rules across the 3 databases:
 *  - The spendable balance is `users.points_balance` in DB1; the catalogue and
 *    the redemption ledger are in DB3. A single SQL transaction cannot span two
 *    Neon databases, so redemption is two ordered steps: the conditional debit
 *    in DB1 (`points_balance >= cost`) always runs first, then the DB3 request
 *    row is inserted. If that insert fails the debit is refunded immediately.
 *  - Rejecting a pending request updates the DB3 row guarded by
 *    `status = 'pending'` (so a double-click can never refund twice) and only
 *    then credits the points back in DB1.
 */

export const UC_UID_PATTERN = /^\d{8,12}$/;

export type RewardItem = {
  id: string;
  title: string;
  ucAmount: number;
  pointsCost: number;
  badge: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type Redemption = {
  id: string;
  rewardTitle: string;
  ucAmount: number;
  pointsCost: number;
  playerUid: string;
  playerName: string | null;
  status: string;
  adminNote: string | null;
  processedBy: string | null;
  processedAt: string | null;
  createdAt: string | null;
};

type RedemptionRow = {
  id: string;
  rewardTitle: string;
  ucAmount: number;
  pointsCost: number;
  playerUid: string;
  playerName: string | null;
  status: string;
  adminNote: string | null;
  processedBy: string | null;
  processedAt: unknown;
  createdAt: unknown;
};

const iso = (value: unknown): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const toRewardItem = (row: typeof rewardItems.$inferSelect): RewardItem => ({
  id: row.id,
  title: row.title,
  ucAmount: row.ucAmount,
  pointsCost: row.pointsCost,
  badge: row.badge,
  sortOrder: row.sortOrder,
  isActive: row.isActive,
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
});

const toRedemption = (row: RedemptionRow): Redemption => ({
  id: String(row.id),
  rewardTitle: row.rewardTitle,
  ucAmount: Number(row.ucAmount) || 0,
  pointsCost: Number(row.pointsCost) || 0,
  playerUid: row.playerUid,
  playerName: row.playerName,
  status: row.status,
  adminNote: row.adminNote,
  processedBy: row.processedBy,
  processedAt: iso(row.processedAt),
  createdAt: iso(row.createdAt),
});

/** Validate admin input for create (all fields) or patch (only supplied fields). */
export function parseRewardInput(
  data: Record<string, unknown>,
  partial: boolean,
): { value?: Partial<Omit<RewardItem, "id" | "createdAt" | "updatedAt">>; error?: string } {
  const value: Partial<Omit<RewardItem, "id" | "createdAt" | "updatedAt">> = {};

  if (!partial || data.title !== undefined) {
    const title = String(data.title ?? "").trim().slice(0, 180);
    if (title.length < 3) return { error: "Give the reward a title (at least 3 characters)." };
    value.title = title;
  }
  if (!partial || data.ucAmount !== undefined) {
    const ucAmount = Number(data.ucAmount);
    if (!Number.isInteger(ucAmount) || ucAmount < 1 || ucAmount > 10_000_000) {
      return { error: "UC amount must be a whole number between 1 and 10,000,000." };
    }
    value.ucAmount = ucAmount;
  }
  if (!partial || data.pointsCost !== undefined) {
    const pointsCost = Number(data.pointsCost);
    if (!Number.isInteger(pointsCost) || pointsCost < 1 || pointsCost > 10_000_000) {
      return { error: "Points cost must be a whole number between 1 and 10,000,000." };
    }
    value.pointsCost = pointsCost;
  }
  if (data.badge !== undefined) {
    value.badge = String(data.badge ?? "").trim().slice(0, 48) || null;
  }
  if (data.sortOrder !== undefined) {
    const sortOrder = Number(data.sortOrder);
    value.sortOrder = Number.isInteger(sortOrder) ? Math.max(-10_000, Math.min(10_000, sortOrder)) : 0;
  } else if (!partial) {
    value.sortOrder = 0;
  }
  if (data.isActive !== undefined) {
    value.isActive = Boolean(data.isActive);
  } else if (!partial) {
    value.isActive = true;
  }
  return { value };
}

/** Points store catalogue. Customers see active items only. */
export async function listRewardItems({ activeOnly }: { activeOnly: boolean }): Promise<RewardItem[] | null> {
  const ready = await ensureReferralTables();
  if (!ready) return null;
  const rows = await db3.select()
    .from(rewardItems)
    .where(activeOnly ? eq(rewardItems.isActive, true) : undefined)
    .orderBy(asc(rewardItems.sortOrder), asc(rewardItems.pointsCost));
  return rows.map(toRewardItem);
}

export async function createRewardItem(
  input: Partial<Omit<RewardItem, "id" | "createdAt" | "updatedAt">>,
): Promise<RewardItem | null> {
  const ready = await ensureReferralTables();
  if (!ready) return null;
  const [row] = await db3.insert(rewardItems)
    .values({
      title: input.title ?? "",
      ucAmount: input.ucAmount ?? 0,
      pointsCost: input.pointsCost ?? 0,
      badge: input.badge ?? null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    })
    .returning();
  return toRewardItem(row);
}

export async function updateRewardItem(
  id: string,
  patch: Partial<Omit<RewardItem, "id" | "createdAt" | "updatedAt">>,
): Promise<RewardItem | null | "not_found"> {
  const ready = await ensureReferralTables();
  if (!ready) return null;
  if (!isUuid(id)) return "not_found";
  const [row] = await db3.update(rewardItems)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(rewardItems.id, id))
    .returning();
  return row ? toRewardItem(row) : "not_found";
}

export async function deleteRewardItem(id: string): Promise<boolean | null> {
  const ready = await ensureReferralTables();
  if (!ready) return null;
  if (!isUuid(id)) return false;
  const deleted = await db3.delete(rewardItems).where(eq(rewardItems.id, id)).returning({ id: rewardItems.id });
  return deleted.length > 0;
}

export type RedeemResult =
  | { ok: true; redemption: Redemption; balance: number }
  | { ok: false; status: number; error: string };

/**
 * Spend points on a reward. The balance (DB1) is debited first, then the
 * `pending` request is written to DB3 (with a compensating refund on failure).
 */
export async function redeemReward(input: {
  userId: string;
  itemId: string;
  playerUid: string;
  playerName: string | null;
}): Promise<RedeemResult> {
  const ready = await ensureReferralTables();
  if (!ready) return { ok: false, status: 503, error: "Database unavailable. Please try again." };
  if (!isUuid(input.userId)) {
    return { ok: false, status: 503, error: "Your account is still syncing. Please sign out and sign in again." };
  }
  if (!isUuid(input.itemId)) return { ok: false, status: 404, error: "This reward is not available." };

  const [item] = await db3.select()
    .from(rewardItems)
    .where(and(eq(rewardItems.id, input.itemId), eq(rewardItems.isActive, true)))
    .limit(1);
  if (!item) return { ok: false, status: 404, error: "This reward is not available right now." };

  // ── Step 1: debit the balance in DB1 (users) ────────────────────────────
  // The points ledger and the reward catalogue live in DB3, while the
  // spendable balance is a user-profile column in DB1. A single Postgres
  // transaction cannot span two databases, so the debit is the authoritative
  // step: the redemption row is only created once the debit succeeded, and a
  // failed insert refunds the balance below.
  const debited = await db1
    .update(users)
    .set({
      pointsBalance: sql`${users.pointsBalance} - ${item.pointsCost}::int`,
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, input.userId), gte(users.pointsBalance, item.pointsCost)))
    .returning({ id: users.id });
  if (!debited.length) {
    const balance = await getPointsBalance(input.userId);
    if (balance === null) return { ok: false, status: 404, error: "Account not found. Please sign in again." };
    const missing = Math.max(0, item.pointsCost - balance);
    return {
      ok: false,
      status: 400,
      error: `Not enough points. You need ${missing.toLocaleString("en-IN")} more points for this reward.`,
    };
  }

  // ── Step 2: create the pending redemption in DB3 ────────────────────────
  try {
    const [row] = await db3.insert(pointRedemptions)
      .values({
        userId: input.userId,
        rewardId: item.id,
        rewardTitle: item.title,
        ucAmount: item.ucAmount,
        pointsCost: item.pointsCost,
        playerUid: input.playerUid,
        playerName: input.playerName,
        status: "pending",
      })
      .returning();

    if (!row) throw new Error("Redemption insert returned no row");
    const balance = await getPointsBalance(input.userId);
    return { ok: true, redemption: toRedemption(row), balance: balance ?? 0 };
  } catch (error) {
    // Compensating refund — never leave a customer's points debited without a request.
    await db1.execute(sql`
        UPDATE users
        SET points_balance = points_balance + ${item.pointsCost}::int, updated_at = now()
        WHERE id = ${input.userId}::uuid
      `)
      .catch(() => undefined);
    console.error("Redemption insert failed; points refunded:", error);
    return { ok: false, status: 500, error: "Could not complete this redemption. Please try again." };
  }
}

export async function getPointsBalance(userId: string): Promise<number | null> {
  if (!isUuid(userId)) return null;
  const [row] = await db1.select({ balance: users.pointsBalance }).from(users).where(eq(users.id, userId)).limit(1);
  return row ? row.balance : null;
}

/** A customer's own redemption history. */
export async function listRedemptionsForUser(userId: string): Promise<Redemption[]> {
  const ready = await ensureReferralTables();
  if (!ready || !isUuid(userId)) return [];
  const rows = await db3.select()
    .from(pointRedemptions)
    .where(eq(pointRedemptions.userId, userId))
    .orderBy(desc(pointRedemptions.createdAt))
    .limit(100);
  return rows.map((row) =>
    toRedemption(row),
  );
}

export type AdminRedemption = Redemption & {
  userId: string;
  userName: string;
  userEmail: string;
};

export type RedemptionCounts = Record<"pending" | "completed" | "rejected", { count: number; points: number }>;

/** Admin queue. `status` filters the list; `counts` always covers every status. */
export async function listRedemptionsForAdmin(status: string | null): Promise<{
  redemptions: AdminRedemption[];
  counts: RedemptionCounts;
} | null> {
  const ready = await ensureReferralTables();
  if (!ready) return null;

  const filter = status && ["pending", "completed", "rejected"].includes(status) ? status : null;
  const rows = await db3.select()
    .from(pointRedemptions)
    .where(filter ? eq(pointRedemptions.status, filter) : undefined)
    .orderBy(desc(pointRedemptions.createdAt))
    .limit(300);

  // Users live in DB1 — resolve the buyer names with one batched lookup
  // instead of a cross-database JOIN (impossible across separate Neon DBs).
  const userIds = [...new Set(rows.map((row) => row.userId).filter(isUuid))];
  const userRows = userIds.length
    ? await db1.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, userIds))
    : [];
  const userMap = new Map(userRows.map((row) => [row.id, row]));

  const countRows = rowsOf<{ status: string; count: number; points: number }>(
    await db3.execute(sql`
      SELECT status, COUNT(*)::int AS count, COALESCE(SUM(points_cost), 0)::int AS points
      FROM point_redemptions
      GROUP BY status
    `),
  );
  const counts: RedemptionCounts = {
    pending: { count: 0, points: 0 },
    completed: { count: 0, points: 0 },
    rejected: { count: 0, points: 0 },
  };
  for (const row of countRows) {
    if (row.status in counts) {
      counts[row.status as keyof RedemptionCounts] = { count: Number(row.count) || 0, points: Number(row.points) || 0 };
    }
  }

  return {
    redemptions: rows.map((row) => {
      const user = userMap.get(row.userId);
      return {
        ...toRedemption(row),
        userId: row.userId,
        userName: user?.name ?? "",
        userEmail: user?.email ?? "",
      };
    }),
    counts,
  };
}

/** Mark a pending request as delivered. Points were already spent at request time. */
export async function completeRedemption(
  id: string,
  adminEmail: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const ready = await ensureReferralTables();
  if (!ready) return { ok: false, status: 503, error: "Database unavailable. Please try again." };
  if (!isUuid(id)) return { ok: false, status: 404, error: "Redemption not found." };

  const updated = await db3.update(pointRedemptions)
    .set({ status: "completed", processedBy: adminEmail.slice(0, 180), processedAt: new Date() })
    .where(and(eq(pointRedemptions.id, id), eq(pointRedemptions.status, "pending")))
    .returning({ id: pointRedemptions.id });
  if (updated.length) return { ok: true };

  const [exists] = await db3.select({ status: pointRedemptions.status }).from(pointRedemptions).where(eq(pointRedemptions.id, id)).limit(1);
  if (!exists) return { ok: false, status: 404, error: "Redemption not found." };
  return { ok: false, status: 409, error: `This request is already ${exists.status}.` };
}

/** Reject a pending request and refund its points — one statement, so it happens exactly once. */
export async function rejectRedemption(
  id: string,
  adminEmail: string,
  note: string | null,
): Promise<{ ok: true; refunded: number } | { ok: false; status: number; error: string }> {
  const ready = await ensureReferralTables();
  if (!ready) return { ok: false, status: 503, error: "Database unavailable. Please try again." };
  if (!isUuid(id)) return { ok: false, status: 404, error: "Redemption not found." };

  // DB3: flip the request to rejected exactly once (only while `pending`).
  const rejectedRows = await db3.update(pointRedemptions)
    .set({
      status: "rejected",
      processedBy: adminEmail.slice(0, 180),
      processedAt: new Date(),
      adminNote: note,
    })
    .where(and(eq(pointRedemptions.id, id), eq(pointRedemptions.status, "pending")))
    .returning({ userId: pointRedemptions.userId, pointsCost: pointRedemptions.pointsCost });

  if (rejectedRows.length) {
    // DB1: refund the points to the buyer's profile. If this fails the admin
    // can retry — the redemption is already rejected, so no double refund.
    let refunded = 0;
    for (const row of rejectedRows) {
      const refundedRows = await db1
        .update(users)
        .set({
          pointsBalance: sql`${users.pointsBalance} + ${row.pointsCost}::int`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, row.userId))
        .returning({ id: users.id });
      refunded += refundedRows.length;
    }
    return { ok: true, refunded };
  }

  const [exists] = await db3.select({ status: pointRedemptions.status }).from(pointRedemptions).where(eq(pointRedemptions.id, id)).limit(1);
  if (!exists) return { ok: false, status: 404, error: "Redemption not found." };
  return { ok: false, status: 409, error: `This request is already ${exists.status}.` };
}
