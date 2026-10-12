import { db } from "@/db";
import { rewardItems, siteSettings } from "@/db/schema";
import { count, eq, sql } from "drizzle-orm";
import { ensureAuthTables } from "@/lib/auth-tables";
import { ensureOrderColumns } from "@/lib/order-columns";
import { DEFAULT_REWARD_ITEMS } from "@/lib/referral-config";

/**
 * Idempotent, zero-downtime bootstrap for the Refer & Earn / Points Store tables.
 *
 * Same pattern as `ensureAuthTables()`: every referral route calls this before
 * touching the new tables, so a fresh or existing database is upgraded in place.
 * Nothing is ever dropped. The canonical SQL lives in
 * `sql/004_referral_and_points.sql`.
 *
 * The `users` columns (referral_code, referred_by, points_balance) are added by
 * `ensureAuthTables()`, and `orders.commissionable` by `ensureOrderColumns()`.
 */
type G = typeof globalThis & { __bgmiReferralTablesReady?: Promise<boolean> };

/**
 * site_settings marker: the example reward is seeded exactly once. Once the
 * marker exists, an admin who deletes every reward is never overridden.
 */
const SEED_MARKER = "reward_store_seeded";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS referral_commissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id uuid NOT NULL,
    referred_user_id uuid NOT NULL,
    order_id uuid NOT NULL,
    order_code varchar(24) NOT NULL,
    purchase_amount integer NOT NULL,
    commission_percent integer NOT NULL,
    points integer NOT NULL,
    status varchar(16) NOT NULL DEFAULT 'credited',
    created_at timestamptz NOT NULL DEFAULT now(),
    reversed_at timestamptz
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS referral_commissions_order_id_unique ON referral_commissions (order_id)`,
  `CREATE INDEX IF NOT EXISTS referral_commissions_referrer_idx ON referral_commissions (referrer_id)`,

  `CREATE TABLE IF NOT EXISTS reward_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title varchar(180) NOT NULL,
    uc_amount integer NOT NULL,
    points_cost integer NOT NULL,
    badge varchar(48),
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,

  `CREATE TABLE IF NOT EXISTS point_redemptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    reward_id uuid,
    reward_title varchar(180) NOT NULL,
    uc_amount integer NOT NULL,
    points_cost integer NOT NULL,
    player_uid varchar(64) NOT NULL,
    player_name varchar(120),
    status varchar(16) NOT NULL DEFAULT 'pending',
    admin_note varchar(255),
    processed_by varchar(180),
    processed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS point_redemptions_user_idx ON point_redemptions (user_id)`,
  `CREATE INDEX IF NOT EXISTS point_redemptions_status_idx ON point_redemptions (status, created_at DESC)`,
];

/** Seed the example reward once. Non-fatal: a failure only delays the seed to the next cold start. */
async function seedDefaultRewardsOnce(): Promise<void> {
  const [marker] = await db
    .select({ key: siteSettings.settingKey })
    .from(siteSettings)
    .where(eq(siteSettings.settingKey, SEED_MARKER))
    .limit(1);
  if (marker) return;

  const [{ value: existing }] = await db.select({ value: count() }).from(rewardItems);
  if (Number(existing) === 0) {
    await db.insert(rewardItems).values(DEFAULT_REWARD_ITEMS);
  }
  await db
    .insert(siteSettings)
    .values({ settingKey: SEED_MARKER, value: true })
    .onConflictDoNothing();
}

export function ensureReferralTables(): Promise<boolean> {
  const g = globalThis as G;
  if (g.__bgmiReferralTablesReady) return g.__bgmiReferralTablesReady;

  g.__bgmiReferralTablesReady = (async () => {
    try {
      if (!(await ensureAuthTables())) throw new Error("users table unavailable");
      await ensureOrderColumns();

      for (const statement of STATEMENTS) {
        await db.execute(sql.raw(statement));
      }
    } catch {
      // Database unreachable or lacking privileges — retry on the next request.
      g.__bgmiReferralTablesReady = undefined;
      return false;
    }

    try {
      await seedDefaultRewardsOnce();
    } catch {
      // Non-fatal — the tables are ready; the example reward is simply not seeded yet.
    }
    return true;
  })();

  return g.__bgmiReferralTablesReady;
}
