-- ============================================================================
--  Migration 004 — Refer & Earn + Points Store (points → UC redemption)
--
--  Safe to run repeatedly (every statement is idempotent). Nothing is dropped
--  and no existing row is changed, except that the first run seeds one example
--  reward when the reward_items table is created.
--
--  Run with:   psql "$DATABASE_URL" -f sql/004_referral_and_points.sql
--  (The app applies the same statements automatically at runtime — see
--   src/lib/auth-tables.ts, src/lib/order-columns.ts, src/lib/referral-tables.ts)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. users — share code, parent (referrer) and spendable points
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code varchar(16);  -- unique share code, e.g. K7FQ2MBX
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by uuid;           -- users.id of the referrer (parent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS points_balance integer NOT NULL DEFAULT 0;

-- NULLs are allowed (accounts created before this migration get a code on their next sign-in).
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_unique ON users (referral_code);
CREATE INDEX IF NOT EXISTS users_referred_by_idx ON users (referred_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. orders — commission eligibility
--    false on bookkeeping copies (the OTP row created by verify-payment) so one
--    real purchase can never earn referral commission twice.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS commissionable boolean NOT NULL DEFAULT true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. referral_commissions — ledger of commission credited to referrers
--    One row per purchase (order_id is unique). status: credited | reversed.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_commissions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id        uuid NOT NULL,
  referred_user_id   uuid NOT NULL,
  order_id           uuid NOT NULL,
  order_code         varchar(24) NOT NULL,
  purchase_amount    integer NOT NULL,      -- ₹ actually paid
  commission_percent integer NOT NULL,      -- 20
  points             integer NOT NULL,      -- floor(purchase_amount × 20%)
  status             varchar(16) NOT NULL DEFAULT 'credited',
  created_at         timestamptz NOT NULL DEFAULT now(),
  reversed_at        timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_commissions_order_id_unique ON referral_commissions (order_id);
CREATE INDEX IF NOT EXISTS referral_commissions_referrer_idx ON referral_commissions (referrer_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. reward_items — points store catalogue (UC packages bought with points)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reward_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       varchar(180) NOT NULL,
  uc_amount   integer NOT NULL,
  points_cost integer NOT NULL,
  badge       varchar(48),
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Example from the business brief: 2000 points → 3800 UC.
-- Seeded exactly once: a marker row in site_settings records that it ran, so an
-- admin who later deletes every reward is never overridden. (Same marker as
-- src/lib/referral-tables.ts.)
CREATE TABLE IF NOT EXISTS site_settings (
  setting_key varchar(80) PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO reward_items (title, uc_amount, points_cost, badge, sort_order, is_active)
SELECT '3800 UC Package', 3800, 2000, 'POINTS STORE', 10, true
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'reward_store_seeded')
  AND NOT EXISTS (SELECT 1 FROM reward_items);

INSERT INTO site_settings (setting_key, value)
VALUES ('reward_store_seeded', 'true'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. point_redemptions — points → UC requests (pending → completed | rejected)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS point_redemptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  reward_id    uuid,                        -- reference only; snapshot columns keep history
  reward_title varchar(180) NOT NULL,
  uc_amount    integer NOT NULL,
  points_cost  integer NOT NULL,
  player_uid   varchar(64) NOT NULL,        -- BGMI character ID the UC is delivered to
  player_name  varchar(120),
  status       varchar(16) NOT NULL DEFAULT 'pending',
  admin_note   varchar(255),
  processed_by varchar(180),
  processed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS point_redemptions_user_idx ON point_redemptions (user_id);
CREATE INDEX IF NOT EXISTS point_redemptions_status_idx ON point_redemptions (status, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Business rules (enforced in src/lib/referrals.ts and src/lib/rewards.ts)
--   • Commission = floor(amount paid × 20%) points, credited when the order is
--     payment_confirmed or delivered; reversed if it is later cancelled/deleted.
--   • Redeeming debits points_balance and inserts a pending request in one statement.
--   • Rejecting a pending request refunds the points exactly once.
-- ─────────────────────────────────────────────────────────────────────────────
