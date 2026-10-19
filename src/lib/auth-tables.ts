import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Idempotent, zero-downtime bootstrap for the Google-auth + tracking tables.
 *
 * Mirrors the existing `ensureUserTables()` pattern: every auth/track route
 * calls this before touching `users` / `site_logs`, so a fresh database is
 * provisioned automatically and an existing one is upgraded in place.
 * Nothing is ever dropped or overwritten.
 *
 * The canonical SQL also lives in `sql/001_google_auth_and_site_logs.sql`
 * for teams that prefer running migrations manually.
 */
type G = typeof globalThis & { __bgmiAuthTablesReady?: Promise<boolean> };

const STATEMENTS = [
  // Base table (new installs).
  `CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(180) UNIQUE,
    whatsapp varchar(24) UNIQUE,
    name varchar(120) NOT NULL,
    google_id varchar(64) UNIQUE,
    avatar_url text,
    password_hash text,
    role varchar(20) NOT NULL DEFAULT 'customer',
    is_active boolean NOT NULL DEFAULT true,
    last_login_at timestamptz,
    referral_code varchar(16),
    referred_by uuid,
    points_balance integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,

  // Upgrade path for databases created by the old password-login build.
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id varchar(64)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz`,
  `ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique ON users (google_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email))`,

  // Refer & Earn: unique share code, parent user id and spendable points.
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code varchar(16)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by uuid`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS points_balance integer NOT NULL DEFAULT 0`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_unique ON users (referral_code)`,
  `CREATE INDEX IF NOT EXISTS users_referred_by_idx ON users (referred_by)`,

  // Visitor / page tracking.
  `CREATE TABLE IF NOT EXISTS site_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid,
    user_email varchar(180),
    user_name varchar(120),
    ip_address varchar(64),
    page_url text NOT NULL,
    referrer text,
    user_agent text,
    country varchar(120),
    city varchar(120),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS site_logs_created_at_idx ON site_logs (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS site_logs_user_email_idx ON site_logs (user_email)`,
];

export function ensureAuthTables(): Promise<boolean> {
  const g = globalThis as G;
  if (g.__bgmiAuthTablesReady) return g.__bgmiAuthTablesReady;

  g.__bgmiAuthTablesReady = (async () => {
    const [createUsers, ...rest] = STATEMENTS;
    try {
      // If this fails the database is unreachable — retry on the next request.
      await db.execute(sql.raw(createUsers));
    } catch {
      g.__bgmiAuthTablesReady = undefined;
      return false;
    }
    for (const statement of rest) {
      try {
        await db.execute(sql.raw(statement));
      } catch {
        // Best effort: an ALTER/INDEX may already be satisfied, or a legacy
        // row may block a unique index. Never block the request for it.
      }
    }
    return true;
  })();

  return g.__bgmiAuthTablesReady;
}
