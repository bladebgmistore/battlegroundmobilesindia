import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Idempotent, zero-downtime bootstrap for the Support Tickets tables
 * (order-based "Chat with Admin" tickets + chat messages).
 *
 * Same pattern as `ensureProofTables()`: every support route calls this
 * before touching the tables, so a fresh or existing database is upgraded in
 * place. Nothing is ever dropped. The canonical SQL lives in
 * `sql/006_support_tickets_and_notifications.sql`.
 */
type G = typeof globalThis & { __bgmiSupportTablesReady?: Promise<boolean> };

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS support_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL UNIQUE,
    order_code varchar(24) NOT NULL,
    user_id uuid NOT NULL,
    customer_name varchar(120),
    customer_email varchar(180),
    product_name varchar(180) NOT NULL,
    status varchar(16) NOT NULL DEFAULT 'open',
    last_message_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON support_tickets (user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS support_tickets_activity_idx ON support_tickets (last_message_at DESC NULLS LAST, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS support_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL,
    sender varchar(12) NOT NULL,
    sender_name varchar(120),
    message text NOT NULL,
    attachment text,
    attachment_name varchar(255),
    attachment_type varchar(64),
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON support_messages (ticket_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS support_messages_unread_idx ON support_messages (ticket_id, sender, is_read)`,
];

export function ensureSupportTables(): Promise<boolean> {
  const g = globalThis as G;
  if (g.__bgmiSupportTablesReady) return g.__bgmiSupportTablesReady;

  g.__bgmiSupportTablesReady = (async () => {
    try {
      for (const statement of STATEMENTS) {
        await db.execute(sql.raw(statement));
      }
    } catch {
      // Database unreachable or lacking privileges — retry on the next request.
      g.__bgmiSupportTablesReady = undefined;
      return false;
    }
    return true;
  })();

  return g.__bgmiSupportTablesReady;
}
