-- ============================================================================
--  007_phone_auth.sql — Firebase Phone Auth (+91 OTP) accounts
--
--  Optional: the app self-provisions this via `ensureAuthTables()`
--  (src/lib/auth-tables.ts) on the first request after deploying the new code.
--  Run this file only if you prefer applying migrations manually.
--
--  Safe to run repeatedly — every statement is idempotent and no data is ever
--  deleted or rewritten.
-- ============================================================================

-- Firebase Phone Auth uid. NULL for Google accounts (and all legacy rows).
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_uid varchar(128);

-- One account per verified Firebase phone identity.
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_uid_unique ON users (phone_uid);

-- Notes
-- ─────
-- • `users.whatsapp` (already present + UNIQUE) also stores the customer's
--   verified +91 number in its 10-digit local form, so order prefill and the
--   checkout form keep working unchanged for phone accounts.
-- • `users.email` stays NULL for phone-only accounts — email is owned by Google.
-- • `users.role` for phone accounts is always `customer`; staff/owner roles are
--   still resolved from OWNER_EMAIL + the staff_members table by email.
