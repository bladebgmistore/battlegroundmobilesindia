-- ============================================================================
-- 003 — staff_members (owner-managed team for the /admin area)
--
-- Mirrors the automatic bootstrap in src/lib/staff.ts (ensureStaffTables):
-- the app creates this table on first use, so running this file manually is
-- only needed if you prefer applying migrations yourself.
--
-- Each row grants one Google account an admin / manager / moderator role.
-- Owners are NOT stored here — the owner role always comes from the
-- OWNER_EMAIL environment variable.
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(180) NOT NULL UNIQUE,           -- Google account email (lowercase)
  name varchar(120),                            -- optional display name
  role varchar(20) NOT NULL DEFAULT 'moderator',-- admin | manager | moderator
  is_active boolean NOT NULL DEFAULT true,
  added_by varchar(180),                        -- email of the owner who granted access
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_members_email_lower_idx ON staff_members (lower(email));

-- Example (or just use Admin Panel → Team & Roles):
-- INSERT INTO staff_members (email, name, role, added_by)
-- VALUES ('friend@gmail.com', 'Friend', 'manager', 'manavjeph800@gmail.com')
-- ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, is_active = true;
