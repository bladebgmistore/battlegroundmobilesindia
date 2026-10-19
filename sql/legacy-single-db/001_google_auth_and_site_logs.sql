-- ============================================================================
--  Battleground Mobile India Store
--  Migration 001 — Google Sign-In + visitor / page tracking
--
--  Safe to run repeatedly (every statement is IF NOT EXISTS / idempotent).
--  Nothing is dropped and no existing row is modified.
--
--  Run with:   psql "$DATABASE_URL" -f sql/001_google_auth_and_site_logs.sql
--  (The app also applies this automatically — see src/lib/auth-tables.ts)
-- ============================================================================

-- gen_random_uuid() lives in pgcrypto on older Postgres; Neon ships it built-in.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Users — now identified by their Google account
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         varchar(180) UNIQUE,
  whatsapp      varchar(24)  UNIQUE,
  name          varchar(120) NOT NULL,
  google_id     varchar(64)  UNIQUE,          -- Google "sub" claim
  avatar_url    text,                         -- Google profile picture
  password_hash text,                         -- legacy, nullable, unused
  role          varchar(20)  NOT NULL DEFAULT 'customer',  -- 'customer' | 'owner'
  is_active     boolean      NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

-- Upgrade path for databases created by the old password-login build.
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id     varchar(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url    text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique  ON users (google_id);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx   ON users (lower(email));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. site_logs — one row per page view (admin "Visitor Logs" table)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid,                 -- users.id (nullable: user row may be new)
  user_email varchar(180),         -- who visited
  user_name  varchar(120),
  ip_address varchar(64),          -- real client IP (proxy headers resolved)
  page_url   text NOT NULL,        -- which page
  referrer   text,
  user_agent text,
  country    varchar(120),
  city       varchar(120),
  created_at timestamptz NOT NULL DEFAULT now()   -- when
);

CREATE INDEX IF NOT EXISTS site_logs_created_at_idx ON site_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS site_logs_user_email_idx ON site_logs (user_email);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Optional housekeeping — keep the log table small
--    DELETE FROM site_logs WHERE created_at < now() - interval '90 days';
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Make the owner explicit in the database as well (optional; the app
--    derives the role from the OWNER_EMAIL env var on every login).
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE users SET role = 'owner' WHERE lower(email) = 'manavjeph800@gmail.com';
