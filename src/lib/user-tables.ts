import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Zero-downtime, idempotent table bootstrap for the customer-account feature.
 *
 * Mirrors `ensureOrderColumns`: on a fresh or pre-existing database the
 * `users`, `user_sessions` and `password_resets` tables may not exist yet.
 * Every user/auth route calls this helper before touching those tables so the
 * correct schema is guaranteed — without a separate migration step and without
 * ever deleting data.
 *
 * The result is memoised per process so the CREATE TABLE statements run at
 * most once per cold start. If the DB is offline it silently returns false and
 * callers fall back to the in-memory demo store.
 */
type G = typeof globalThis & { __bgmiUserTablesReady?: Promise<boolean> };

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(180) UNIQUE,
    whatsapp varchar(24) UNIQUE,
    name varchar(120) NOT NULL,
    password_hash text NOT NULL,
    role varchar(20) NOT NULL DEFAULT 'customer',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS user_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token varchar(140) NOT NULL UNIQUE,
    user_id uuid NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS password_resets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(180) NOT NULL,
    otp_hash varchar(100) NOT NULL,
    attempts integer NOT NULL DEFAULT 0,
    is_used boolean NOT NULL DEFAULT false,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
];

export function ensureUserTables(): Promise<boolean> {
  const g = globalThis as G;
  if (g.__bgmiUserTablesReady) return g.__bgmiUserTablesReady;

  g.__bgmiUserTablesReady = (async () => {
    try {
      for (const statement of STATEMENTS) {
        await db.execute(sql.raw(statement));
      }
      return true;
    } catch {
      // Database offline — never block the request. Reset so the next request retries.
      g.__bgmiUserTablesReady = undefined;
      return false;
    }
  })();

  return g.__bgmiUserTablesReady;
}
