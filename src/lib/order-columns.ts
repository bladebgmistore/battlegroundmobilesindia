import { db3 } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Zero-downtime, idempotent bootstrap for the DB3 `orders` table.
 *
 * A brand-new DB3 database gets the full table on the first checkout; a
 * database created by an older build is upgraded in place with the ALTER
 * statements below. Every order API route calls this helper before touching
 * the table — no separate migration step and no data is ever deleted.
 *
 * The result is memoised per lambda/process so the DDL runs at most once per
 * cold start. The canonical DDL also lives in `drizzle/db3/`.
 */
type G = typeof globalThis & { __bgmiOrderColumnsReady?: Promise<boolean> };

const STATEMENTS = [
  // New installs — full orders table.
  `CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_code varchar(24) NOT NULL UNIQUE,
    user_id uuid,
    category_slug varchar(48),
    customer_name varchar(100) NOT NULL,
    customer_whatsapp varchar(24) NOT NULL,
    player_uid varchar(64),
    player_name varchar(120),
    product_name varchar(180) NOT NULL,
    original_amount integer NOT NULL DEFAULT 0,
    discount_amount integer NOT NULL DEFAULT 0,
    coupon_code varchar(50),
    amount integer NOT NULL,
    status varchar(24) NOT NULL DEFAULT 'awaiting_contact',
    account_login_type varchar(48),
    account_email varchar(180),
    account_password text,
    otp_code varchar(24),
    verification_paid boolean NOT NULL DEFAULT false,
    verification_screenshot text,
    verification_paid_at timestamptz,
    payment_screenshot text,
    buyer_ip varchar(64),
    buyer_city varchar(120),
    buyer_region varchar(120),
    buyer_country varchar(120),
    paid_at timestamptz,
    commissionable boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id)`,
  `CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC)`,

  // Upgrade path for databases created by an older build.
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id uuid`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS category_slug varchar(48)`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS account_login_type varchar(48)`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS account_email varchar(180)`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS account_password text`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS otp_code varchar(24)`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS verification_paid boolean NOT NULL DEFAULT false`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS verification_screenshot text`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS verification_paid_at timestamptz`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS player_name varchar(120)`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_screenshot text`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_ip varchar(64)`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_city varchar(120)`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_region varchar(120)`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_country varchar(120)`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at timestamptz`,
  // Refer & Earn: false on bookkeeping copies (OTP rows) so a purchase earns commission once.
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS commissionable boolean NOT NULL DEFAULT true`,
];

export function ensureOrderColumns(): Promise<boolean> {
  const g = globalThis as G;
  if (g.__bgmiOrderColumnsReady) return g.__bgmiOrderColumnsReady;

  g.__bgmiOrderColumnsReady = (async () => {
    try {
      for (const statement of STATEMENTS) {
        await db3.execute(sql.raw(statement));
      }
      return true;
    } catch {
      // Database offline or insufficient privileges — never block the request.
      // Reset the memo so the next request retries.
      g.__bgmiOrderColumnsReady = undefined;
      return false;
    }
  })();

  return g.__bgmiOrderColumnsReady;
}
