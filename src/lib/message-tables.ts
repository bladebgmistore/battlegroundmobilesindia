import { db3 } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Idempotent bootstrap for DB3's `customer_messages` table — the public
 * contact form inbox. Runs on the contact + admin management routes.
 */
type G = typeof globalThis & { __bgmiCustomerMessageTablesReady?: Promise<boolean> };

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS customer_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) NOT NULL,
    whatsapp varchar(24) NOT NULL,
    message text NOT NULL,
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS customer_messages_created_at_idx ON customer_messages (created_at DESC)`,
];

export function ensureCustomerMessageTables(): Promise<boolean> {
  const g = globalThis as G;
  if (g.__bgmiCustomerMessageTablesReady) return g.__bgmiCustomerMessageTablesReady;

  g.__bgmiCustomerMessageTablesReady = (async () => {
    try {
      for (const statement of STATEMENTS) {
        await db3.execute(sql.raw(statement));
      }
      return true;
    } catch {
      g.__bgmiCustomerMessageTablesReady = undefined;
      return false;
    }
  })();

  return g.__bgmiCustomerMessageTablesReady;
}
