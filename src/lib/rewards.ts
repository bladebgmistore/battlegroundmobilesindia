import { db } from "@/db";
import { pointRedemptions, rewardItems, users } from "@/db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { ensureReferralTables } from "@/lib/referral-tables";
import { isUuid } from "@/lib/referrals";
import { rowsOf } from "@/lib/sql-rows";

/**
 * Points Store — reward catalogue, redemptions and their admin workflow.
 *
 * Money-safety rules
 *  - Points are debited with a conditional UPDATE (`points_balance >= cost`) and
 *    the request row is inserted in the SAME statement, so a redemption either
 *    happens completely or not at all — no transaction needed (Neon HTTP has none).
 *  - Rejecting a pending request refunds the points in one statement, guarded by
 *    `status = 'pending'`, so a double-click can never refund twice.
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
  reward_title: string;
  uc_amount: number;
  points_cost: number;
  player_uid: string;
  player_name: string | null;
  status: string;
  admin_note: string | null;
  processed_by: string | null;
  processed_at: unknown;
  created_at: unknown;
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
  rewardTitle: row.reward_title,
  ucAmount: Number(row.uc_amount) || 0,
  pointsCost: Number(row.points_cost) || 0,
  playerUid: row.player_uid,
  playerName: row.player_name,
  status: row.status,
  adminNote: row.admin_note,
  processedBy: row.processed_by,
  processedAt: iso(row.processed_at),
  createdAt: iso(row.created_at),
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
  const rows = await db
    .select()
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
  const [row] = await db
    .insert(rewardItems)
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
  const [row] = await db
    .update(rewardItems)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(rewardItems.id, id))
    .returning();
  return row ? toRewardItem(row) : "not_found";
}

export async function deleteRewardItem(id: string): Promise<boolean | null> {
  const ready = await ensureReferralTables();
  if (!ready) return null;
  if (!isUuid(id)) return false;
  const deleted = await db.delete(rewardItems).where(eq(rewardItems.id, id)).returning({ id: rewardItems.id });
  return deleted.length > 0;
}

export type RedeemResult =
  | { ok: true; redemption: Redemption; balance: number }
  | { ok: false; status: number; error: string };

/**
 * Spend points on a reward. One statement debits the balance and creates the
 * `pending` request, so the points and the request can never get out of sync.
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

  const [item] = await db
    .select()
    .from(rewardItems)
    .where(and(eq(rewardItems.id, input.itemId), eq(rewardItems.isActive, true)))
    .limit(1);
  if (!item) return { ok: false, status: 404, error: "This reward is not available right now." };

  const created = rowsOf<RedemptionRow>(
    await db.execute(sql`
      WITH debit AS (
        UPDATE users
        SET points_balance = points_balance - ${item.pointsCost}::int, updated_at = now()
        WHERE id = ${input.userId}::uuid AND points_balance >= ${item.pointsCost}::int
        RETURNING id
      ),
      inserted AS (
        INSERT INTO point_redemptions
          (user_id, reward_id, reward_title, uc_amount, points_cost, player_uid, player_name, status)
        SELECT debit.id,
               ${item.id}::uuid,
               ${item.title}::varchar,
               ${item.ucAmount}::int,
               ${item.pointsCost}::int,
               ${input.playerUid}::varchar,
               ${input.playerName}::varchar,
               'pending'
        FROM debit
        RETURNING id, reward_title, uc_amount, points_cost, player_uid, player_name, status,
                  admin_note, processed_by, processed_at, created_at
      )
      SELECT * FROM inserted
    `),
  );

  const row = created[0];
  if (row) {
    const balance = await getPointsBalance(input.userId);
    return { ok: true, redemption: toRedemption(row), balance: balance ?? 0 };
  }

  // Nothing was debited: either the account is unknown or the balance is too low.
  const balance = await getPointsBalance(input.userId);
  if (balance === null) return { ok: false, status: 404, error: "Account not found. Please sign in again." };
  const missing = Math.max(0, item.pointsCost - balance);
  return {
    ok: false,
    status: 400,
    error: `Not enough points. You need ${missing.toLocaleString("en-IN")} more points for this reward.`,
  };
}

export async function getPointsBalance(userId: string): Promise<number | null> {
  if (!isUuid(userId)) return null;
  const [row] = await db.select({ balance: users.pointsBalance }).from(users).where(eq(users.id, userId)).limit(1);
  return row ? row.balance : null;
}

/** A customer's own redemption history. */
export async function listRedemptionsForUser(userId: string): Promise<Redemption[]> {
  const ready = await ensureReferralTables();
  if (!ready || !isUuid(userId)) return [];
  const rows = await db
    .select()
    .from(pointRedemptions)
    .where(eq(pointRedemptions.userId, userId))
    .orderBy(desc(pointRedemptions.createdAt))
    .limit(100);
  return rows.map((row) =>
    toRedemption({
      id: row.id,
      reward_title: row.rewardTitle,
      uc_amount: row.ucAmount,
      points_cost: row.pointsCost,
      player_uid: row.playerUid,
      player_name: row.playerName,
      status: row.status,
      admin_note: row.adminNote,
      processed_by: row.processedBy,
      processed_at: row.processedAt,
      created_at: row.createdAt,
    }),
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
  const rows = await db
    .select({
      redemption: pointRedemptions,
      userName: users.name,
      userEmail: users.email,
    })
    .from(pointRedemptions)
    .leftJoin(users, eq(users.id, pointRedemptions.userId))
    .where(filter ? eq(pointRedemptions.status, filter) : undefined)
    .orderBy(desc(pointRedemptions.createdAt))
    .limit(300);

  const countRows = rowsOf<{ status: string; count: number; points: number }>(
    await db.execute(sql`
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
    redemptions: rows.map(({ redemption, userName, userEmail }) => ({
      ...toRedemption({
        id: redemption.id,
        reward_title: redemption.rewardTitle,
        uc_amount: redemption.ucAmount,
        points_cost: redemption.pointsCost,
        player_uid: redemption.playerUid,
        player_name: redemption.playerName,
        status: redemption.status,
        admin_note: redemption.adminNote,
        processed_by: redemption.processedBy,
        processed_at: redemption.processedAt,
        created_at: redemption.createdAt,
      }),
      userId: redemption.userId,
      userName: userName ?? "",
      userEmail: userEmail ?? "",
    })),
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

  const updated = await db
    .update(pointRedemptions)
    .set({ status: "completed", processedBy: adminEmail.slice(0, 180), processedAt: new Date() })
    .where(and(eq(pointRedemptions.id, id), eq(pointRedemptions.status, "pending")))
    .returning({ id: pointRedemptions.id });
  if (updated.length) return { ok: true };

  const [exists] = await db.select({ status: pointRedemptions.status }).from(pointRedemptions).where(eq(pointRedemptions.id, id)).limit(1);
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

  const [result] = rowsOf<{ rejected_count: number; refunded_count: number }>(
    await db.execute(sql`
      WITH rejected AS (
        UPDATE point_redemptions
        SET status = 'rejected',
            processed_by = ${adminEmail.slice(0, 180)}::varchar,
            processed_at = now(),
            admin_note = ${note}::varchar
        WHERE id = ${id}::uuid AND status = 'pending'
        RETURNING user_id, points_cost
      ),
      refund AS (
        UPDATE users u
        SET points_balance = u.points_balance + rejected.points_cost, updated_at = now()
        FROM rejected
        WHERE u.id = rejected.user_id
        RETURNING u.id
      )
      SELECT (SELECT COUNT(*)::int FROM rejected) AS rejected_count,
             (SELECT COUNT(*)::int FROM refund) AS refunded_count
    `),
  );

  if (Number(result?.rejected_count) > 0) {
    return { ok: true, refunded: Number(result?.refunded_count) || 0 };
  }

  const [exists] = await db.select({ status: pointRedemptions.status }).from(pointRedemptions).where(eq(pointRedemptions.id, id)).limit(1);
  if (!exists) return { ok: false, status: 404, error: "Redemption not found." };
  return { ok: false, status: 409, error: `This request is already ${exists.status}.` };
}
