-- ---------------------------------------------------------------------------
-- 002_feedback_moderation.sql
-- Player-submitted reviews + admin moderation (accept / deny).
--
-- Safe to run repeatedly (idempotent). The same statements are executed
-- automatically at runtime by src/lib/feedback-tables.ts.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS feedbacks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(120) NOT NULL,
  review      text         NOT NULL,
  rating      integer      NOT NULL DEFAULT 5,
  avatar      text,
  is_active   boolean      NOT NULL DEFAULT true,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

-- Moderation state: 'pending' | 'approved' | 'rejected'.
-- Rows that already existed were published by the admin => 'approved'.
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS status varchar(16) NOT NULL DEFAULT 'approved';

-- ...but every NEW submission must be approved by the admin first.
ALTER TABLE feedbacks ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS submitted_by_email varchar(180);
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS moderated_at timestamptz;

CREATE INDEX IF NOT EXISTS feedbacks_status_idx     ON feedbacks (status);
CREATE INDEX IF NOT EXISTS feedbacks_created_at_idx ON feedbacks (created_at DESC);

-- Separate favicon setting (independent of the site logo).
CREATE TABLE IF NOT EXISTS site_settings (
  setting_key  varchar(80) PRIMARY KEY,
  value        jsonb       NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- The favicon is managed independently from the logo in Admin -> Site Controls.
INSERT INTO site_settings (setting_key, value)
VALUES ('favicon_url', '""'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;
