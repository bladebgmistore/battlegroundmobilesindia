-- ============================================================================
--  Migration 006 — Order Support Tickets + Notification / Announcement system
--
--  Safe to run repeatedly (every statement is idempotent). Nothing is
--  dropped and no existing row is changed.
--
--  Run with:   psql "$DATABASE_URL" -f sql/006_support_tickets_and_notifications.sql
--  (The app applies the same statements automatically at runtime — see
--   src/lib/support-tables.ts and src/lib/notification-tables.ts)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. support_tickets — one "Chat with Admin" ticket per order.
--    Resolved tickets are DELETED permanently (chat history included).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL UNIQUE,
  order_code      varchar(24) NOT NULL,
  user_id         uuid NOT NULL,
  customer_name   varchar(120),
  customer_email  varchar(180),
  product_name    varchar(180) NOT NULL,
  status          varchar(16) NOT NULL DEFAULT 'open',
  last_message_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON support_tickets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_activity_idx ON support_tickets (last_message_at DESC NULLS LAST, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. support_messages — chat between the buyer and the admin staff.
--    Attachments are stored as client-compressed Base64 data URLs.
--    is_read tracks read state from the opposite side (drives the admin
--    sidebar badge for unread customer messages).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid NOT NULL,
  sender          varchar(12) NOT NULL,          -- 'user' | 'admin'
  sender_name     varchar(120),
  message         text NOT NULL,
  attachment      text,
  attachment_name varchar(255),
  attachment_type varchar(64),
  is_read         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON support_messages (ticket_id, created_at);
CREATE INDEX IF NOT EXISTS support_messages_unread_idx ON support_messages (ticket_id, sender, is_read);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. user_notifications — the header bell inbox.
--    user_id = NULL → broadcast visible to every signed-in user.
--    type: order_update | support_reply | announcement
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid,
  type            varchar(24) NOT NULL,
  badge           varchar(32),
  title           varchar(180) NOT NULL,
  body            text,
  link            varchar(300),
  order_id        uuid,
  ticket_id       uuid,
  announcement_id uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_notifications_user_idx ON user_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_notifications_broadcast_idx ON user_notifications (created_at DESC) WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS user_notifications_ticket_idx ON user_notifications (ticket_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. notification_reads — per-user read state (one row per notification/user).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_reads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL,
  user_id         uuid NOT NULL,
  read_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_reads_unique ON notification_reads (notification_id, user_id);
CREATE INDEX IF NOT EXISTS notification_reads_user_idx ON notification_reads (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. announcements — admin broadcast log. Publishing inserts a matching
--    user_notifications row (broadcast → user_id NULL, targeted → one user).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           varchar(180) NOT NULL,
  message         text NOT NULL,
  badge           varchar(32) NOT NULL DEFAULT 'General',
  target          varchar(12) NOT NULL DEFAULT 'all',   -- 'all' | 'user'
  target_user_id  uuid,
  target_email    varchar(180),
  created_by      varchar(180),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcements_created_idx ON announcements (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. WhatsApp contact channel toggle (admin-controlled).
--    WhatsApp contact UI stays hidden site-wide until the admin enables it
--    from Admin Dashboard → Site Controls.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_settings (
  setting_key varchar(80) PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO site_settings (setting_key, value)
VALUES ('whatsapp_enabled', 'false'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Business rules (enforced in src/lib/support.ts and src/lib/notifications.ts)
--   • One ticket per order; the buyer opens it from "My Orders".
--   • "Close & Resolve Ticket" deletes the ticket + all messages permanently.
--   • Order status changes insert an order_update notification for the buyer.
--   • Admin replies insert a support_reply notification for the buyer.
--   • Admin announcements appear instantly in the target users' bell inbox.
-- ─────────────────────────────────────────────────────────────────────────────
