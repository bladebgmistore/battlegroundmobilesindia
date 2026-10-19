import { db2, db3 } from "@/db";
import { rewardItems, siteSettings } from "@/db/schema";
import { count, eq, sql } from "drizzle-orm";
import { ensureAuthTables } from "@/lib/auth-tables";
import { ensureOrderColumns } from "@/lib/order-columns";
import { DEFAULT_REWARD_ITEMS } from "@/lib/referral-config";

type G = typeof globalThis & { __bgmiReferralTablesReady?: Promise<boolean> };
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

async function seedDefaultRewardsOnce(): Promise<void> {
  const [marker] = await db2.select({ key: siteSettings.settingKey }).from(siteSettings).where(eq(siteSettings.settingKey, SEED_MARKER)).limit(1);
  if (marker) return;
  const [{ value: existing }] = await db3.select({ value: count() }).from(rewardItems);
  if (Number(existing) === 0) {
    await db3.insert(rewardItems).values(DEFAULT_REWARD_ITEMS);
  }
  await db2.insert(siteSettings).values({ settingKey: SEED_MARKER, value: true }).onConflictDoNothing();
}

export function ensureReferralTables(): Promise<boolean> {
  const g = globalThis as G;
  if (g.__bgmiReferralTablesReady) return g.__bgmiReferralTablesReady;
  g.__bgmiReferralTablesReady = (async () => {
    try {
      // DB3 tables first — the points store must work even if DB1 is briefly
      // unreachable. `users.points_balance` is provisioned by ensureAuthTables()
      // on DB1 separately and is retried by that helper on the next request.
      await ensureOrderColumns();
      for (const statement of STATEMENTS) {
        await db3.execute(sql.raw(statement));
      }
      await ensureAuthTables();
    } catch {
      g.__bgmiReferralTablesReady = undefined;
      return false;
    }
    try { await seedDefaultRewardsOnce(); } catch {}
    return true;
  })();
  return g.__bgmiReferralTablesReady;
}
