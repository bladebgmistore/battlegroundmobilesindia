import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Zero-downtime, idempotent column migration for the `orders` table.
 *
 * The live database may have been created before the payment-screenshot /
 * IP-tracking upgrade. Every order API route calls this helper before it
 * touches the table so the new columns always exist — without a separate
 * migration step and without ever deleting data.
 *
 * The result is memoised per lambda/process so the ALTER statements run at
 * most once per cold start.
 */
type G = typeof globalThis & { __bgmiOrderColumnsReady?: Promise<boolean> };

const STATEMENTS = [
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id uuid`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS category_slug varchar(48)`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS account_login_type varchar(48)`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS account_email varchar(180)`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS account_password text`,
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
];

export function ensureOrderColumns(): Promise<boolean> {
  const g = globalThis as G;
  if (g.__bgmiOrderColumnsReady) return g.__bgmiOrderColumnsReady;

  g.__bgmiOrderColumnsReady = (async () => {
    try {
      for (const statement of STATEMENTS) {
        await db.execute(sql.raw(statement));
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
