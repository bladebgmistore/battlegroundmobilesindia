import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Idempotent bootstrap for the player-feedback (reviews) table.
 *
 * Mirrors `ensureAuthTables()`: every feedback route calls this before
 * touching `feedbacks`, so a fresh database is provisioned automatically and
 * an existing one is upgraded in place. Nothing is ever dropped.
 *
 * The canonical SQL also lives in `sql/002_feedback_moderation.sql`.
 */
type G = typeof globalThis & { __bgmiFeedbackTablesReady?: Promise<boolean> };

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS feedbacks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(120) NOT NULL,
    review text NOT NULL,
    rating integer NOT NULL DEFAULT 5,
    avatar text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,

  // --- Moderation upgrade -------------------------------------------------
  // Existing rows were published by the admin, so they default to `approved`.
  `ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS status varchar(16) NOT NULL DEFAULT 'approved'`,
  // New rows (player submissions) must be reviewed first.
  `ALTER TABLE feedbacks ALTER COLUMN status SET DEFAULT 'pending'`,
  `ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS submitted_by_email varchar(180)`,
  `ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS moderated_at timestamptz`,
  `CREATE INDEX IF NOT EXISTS feedbacks_status_idx ON feedbacks (status)`,
  `CREATE INDEX IF NOT EXISTS feedbacks_created_at_idx ON feedbacks (created_at DESC)`,
];

export function ensureFeedbackTables(): Promise<boolean> {
  const g = globalThis as G;
  if (g.__bgmiFeedbackTablesReady) return g.__bgmiFeedbackTablesReady;

  g.__bgmiFeedbackTablesReady = (async () => {
    const [createTable, ...rest] = STATEMENTS;
    try {
      await db.execute(sql.raw(createTable));
    } catch {
      // Database unreachable — retry on the next request.
      g.__bgmiFeedbackTablesReady = undefined;
      return false;
    }
    for (const statement of rest) {
      try {
        await db.execute(sql.raw(statement));
      } catch {
        // Best effort — the column/index may already match.
      }
    }
    return true;
  })();

  return g.__bgmiFeedbackTablesReady;
}
