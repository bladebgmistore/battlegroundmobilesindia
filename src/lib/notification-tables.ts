import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Idempotent, zero-downtime bootstrap for the notification tables:
 * user_notifications (bell inbox), notification_reads (per-user read state)
 * and announcements (admin broadcast log).
 *
 * Same pattern as `ensureProofTables()`. The canonical SQL lives in
 * `sql/006_support_tickets_and_notifications.sql`.
 */
type G = typeof globalThis & { __bgmiNotificationTablesReady?: Promise<boolean> };

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS user_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid,
    type varchar(24) NOT NULL,
    badge varchar(32),
    title varchar(180) NOT NULL,
    body text,
    link varchar(300),
    order_id uuid,
    ticket_id uuid,
    announcement_id uuid,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS user_notifications_user_idx ON user_notifications (user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS user_notifications_broadcast_idx ON user_notifications (created_at DESC) WHERE user_id IS NULL`,
  `CREATE INDEX IF NOT EXISTS user_notifications_ticket_idx ON user_notifications (ticket_id)`,
  `CREATE TABLE IF NOT EXISTS notification_reads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id uuid NOT NULL,
    user_id uuid NOT NULL,
    read_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS notification_reads_unique ON notification_reads (notification_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS notification_reads_user_idx ON notification_reads (user_id)`,
  `CREATE TABLE IF NOT EXISTS announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title varchar(180) NOT NULL,
    message text NOT NULL,
    badge varchar(32) NOT NULL DEFAULT 'General',
    target varchar(12) NOT NULL DEFAULT 'all',
    target_user_id uuid,
    target_email varchar(180),
    created_by varchar(180),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS announcements_created_idx ON announcements (created_at DESC)`,
];

export function ensureNotificationTables(): Promise<boolean> {
  const g = globalThis as G;
  if (g.__bgmiNotificationTablesReady) return g.__bgmiNotificationTablesReady;

  g.__bgmiNotificationTablesReady = (async () => {
    try {
      for (const statement of STATEMENTS) {
        await db.execute(sql.raw(statement));
      }
    } catch {
      // Database unreachable or lacking privileges — retry on the next request.
      g.__bgmiNotificationTablesReady = undefined;
      return false;
    }
    return true;
  })();

  return g.__bgmiNotificationTablesReady;
}
