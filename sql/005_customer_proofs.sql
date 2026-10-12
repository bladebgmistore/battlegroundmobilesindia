-- ============================================================================
--  Migration 005 — Customer Proofs / Order Deliveries (public /proofs page)
--
--  Safe to run repeatedly (every statement is idempotent). Nothing is dropped
--  and no existing row is changed, except that the first run seeds the 26
--  pre-loaded proofs (exact titles & prices from the business brief — the
--  single source of truth is src/lib/proof-seed.ts, which this file mirrors).
--
--  Run with:   psql "$DATABASE_URL" -f sql/005_customer_proofs.sql
--  (The app applies the same statements automatically at runtime — see
--   src/lib/proof-tables.ts, src/lib/proofs.ts)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. customer_proofs — verified order deliveries shown on /proofs
--    order_code looks like #ORD-4127 and is unique; amount is whole rupees;
--    proof_image holds a /public path or an uploaded Base64 screenshot.
--    is_active = false hides a proof from the public page without deleting it.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_proofs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name varchar(120) NOT NULL,
  order_code    varchar(24) NOT NULL,
  product_title varchar(300) NOT NULL,
  amount        integer NOT NULL,
  proof_image   text,
  is_active     boolean NOT NULL DEFAULT true,
  delivered_at  timestamptz,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_proofs_order_code_unique ON customer_proofs (order_code);
CREATE INDEX IF NOT EXISTS customer_proofs_public_idx ON customer_proofs (is_active, delivered_at DESC, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Pre-loaded proofs — 26 verified deliveries with exact titles & prices.
--    Seeded exactly once: a marker row in site_settings records that it ran,
--    so an admin who later deletes every proof is never overridden. (Same
--    marker as src/lib/proof-tables.ts.)
--    Receipt artwork for each row lives in public/proofs/ord-xxxx.svg.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_settings (
  setting_key varchar(80) PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO customer_proofs (customer_name, order_code, product_title, amount, proof_image, is_active, delivered_at, sort_order)
SELECT v.customer_name, v.order_code, v.product_title, v.amount, v.proof_image, v.is_active, v.delivered_at, v.sort_order
FROM (VALUES
  ('Rahul Sharma', '#ORD-4127', 'POWER PACK 900 UC Unknown Cash', 500, '/proofs/ord-4127.svg', true, '2026-09-28'::timestamptz, 100),
  ('Amit Verma', '#ORD-7735', 'TOP UP 1,950 UC Unknown Cash', 950, '/proofs/ord-7735.svg', true, '2026-09-21'::timestamptz, 90),
  ('Priya Patel', '#ORD-3092', 'ELITE 4,000 UC Unknown Cash', 1900, '/proofs/ord-3092.svg', true, '2026-09-14'::timestamptz, 80),
  ('Sandeep Yadav', '#ORD-6648', 'MAXIMUM 4,150 UC Unknown Cash', 2000, '/proofs/ord-6648.svg', true, '2026-09-05'::timestamptz, 70),
  ('Neha Gupta', '#ORD-2210', 'BEST VALUE 8,100 UC Unknown Cash', 3750, '/proofs/ord-2210.svg', true, '2026-08-27'::timestamptz, 60),
  ('Vikram Singh', '#ORD-8453', 'UC BUNDLE 10,800 UC Unknown Cash', 5000, '/proofs/ord-8453.svg', true, '2026-08-18'::timestamptz, 50),
  ('Anjali Mehta', '#ORD-5136', 'M416 GLACIER MAXOUT + 25 KILL MSG 45 LABGUNS', 999, '/proofs/ord-5136.svg', true, '2026-08-09'::timestamptz, 40),
  ('Rohit Kumar', '#ORD-9074', 'GODZILLA SUIT  + 30 LABGUNS LEVEL 70', 2999, '/proofs/ord-9074.svg', true, '2026-07-30'::timestamptz, 30),
  ('Sneha Reddy', '#ORD-1789', 'All X-suit Max Mythic Tag + 190 Gunlab', 12999, '/proofs/ord-1789.svg', true, '2026-07-21'::timestamptz, 20),
  ('Arjun Nair', '#ORD-6420', 'Forest elf Set + 60 Gunlab 15 kill Message', 1299, '/proofs/ord-6420.svg', true, '2026-07-11'::timestamptz, 10),
  ('Kavya Iyer', '#ORD-3358', 'COLLECTION LEVEL 88 (HIGH) 2025 CYBERWEEK TOP 100 TITLE PORSCHE COLLECTOR PRO', 5499, '/proofs/ord-3358.svg', true, '2026-06-29'::timestamptz, 0),
  ('Manish Tiwari', '#ORD-7702', 'COLLECTION LEVEL 85.5 (HIGH) TRIPLE X-SUIT LVL 7 MAX DOUBLE X-SUIT LEVEL 5', 1899, '/proofs/ord-7702.svg', true, '2026-06-17'::timestamptz, -10),
  ('Divya Joshi', '#ORD-2865', 'LAMBO COLLECTOR PRO TITLE PHAROH XSUIT LVL 7 MAX POSEIDON XSUIT LVL 7 MAX', 1299, '/proofs/ord-2865.svg', true, '2026-06-05'::timestamptz, -20),
  ('Karan Malhotra', '#ORD-5981', 'STALWART GUARDIN #6 TITLE 2025 FROST FESTIVAL TITLE SILVANUS XSUIT LVL 7 MAX', 2999, '/proofs/ord-5981.svg', true, '2026-05-24'::timestamptz, -30),
  ('Pooja Desai', '#ORD-4416', 'COLLECTION LEVEL 76 ALMOST PHARAOH XSUIT LVL 6 MAX TRIPLE X-SUIT LEVEL 4', 6999, '/proofs/ord-4416.svg', true, '2026-05-12'::timestamptz, -40),
  ('Vivek Chauhan', '#ORD-8237', 'COLLECTION LEVEL 74 HIGH RAVAN XSUIT LVL 7 MAX FULL EMOJI SET', 4499, '/proofs/ord-8237.svg', true, '2026-04-30'::timestamptz, -50),
  ('Shreya Kulkarni', '#ORD-1573', 'COLLECTION LEVEL 70 HIGH S29 ROYAL LEGEND TITLE FIORE X-SUIT LEVEL 4', 2999, '/proofs/ord-1573.svg', true, '2026-04-18'::timestamptz, -60),
  ('Deepak Pandey', '#ORD-6908', 'COLLECTION LEVEL 82 (HIGH) 2025 FROST POINT TITLE POSRCHE COLLECTOR TITLE RAVAN XSUIT LVL 7 MAX', 9499, '/proofs/ord-6908.svg', true, '2026-04-02'::timestamptz, -70),
  ('Meera Kapoor', '#ORD-3540', 'FULL CP TYPE ACCOUNT PHARAOH XSUIT LVL 6 MAX FOREST ELF SET (RARE) BLACK HITMAN & TUXEDO', 8999, '/proofs/ord-3540.svg', true, '2026-03-21'::timestamptz, -80),
  ('Aditya Rao', '#ORD-7081', 'COLLECTION LEVEL 72 HIGH SILVANUS X SUIT LEVEL 6 PHAROAH X SUIT LEVEL 4', 6499, '/proofs/ord-7081.svg', true, '2026-03-09'::timestamptz, -90),
  ('Nisha Bhat', '#ORD-2694', 'STALWART GUARDIN #6 TITLE SILVANUS XSUIT LVL 7 MAX TRIPLE XSUIT LEVEL 4 FOREST ELF SET', 3999, '/proofs/ord-2694.svg', true, '2026-02-25'::timestamptz, -100),
  ('Gaurav Saxena', '#ORD-5367', 'MCLAREN COLLECTOR (TITLE) IGNIS X-SUIT LEVEL 5 POSIEDON X-SUIT LEVEL 5', 7499, '/proofs/ord-5367.svg', true, '2026-02-11'::timestamptz, -110),
  ('Riya Choudhary', '#ORD-8812', 'SILVANUS XSUIT LVL 7 MAX STYGIAN XSUIT LVL 6 MAX TRIPLE X-SUIT LEVEL 4', 11999, '/proofs/ord-8812.svg', true, '2026-01-28'::timestamptz, -120),
  ('Mohit Agarwal', '#ORD-4450', '2025 COLLECTION FROST TITLE S28 ULTIMATE ROYAL TITLE ALL 3 PEAKY BUNDER SET', 4299, '/proofs/ord-4450.svg', true, '2026-01-14'::timestamptz, -130),
  ('Simran Kaur', '#ORD-6175', 'COLLECTION LEVEL 80 (HIGH) SILVANUS XSUIT LVL 6 MAX RAVAN XSUIT LEVEL 5', 8299, '/proofs/ord-6175.svg', true, '2025-12-30'::timestamptz, -140),
  ('Tanmay Shetty', '#ORD-9238', 'APOLLO COLLECTOR TITLE BUGGATI COLLECTOR TITLE PHARAOH XSUIT LVL 7 MAX', 10500, '/proofs/ord-9238.svg', true, '2025-12-15'::timestamptz, -150)
) AS v(customer_name, order_code, product_title, amount, proof_image, is_active, delivered_at, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'customer_proofs_seeded')
  AND NOT EXISTS (SELECT 1 FROM customer_proofs);

INSERT INTO site_settings (setting_key, value)
VALUES ('customer_proofs_seeded', 'true'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Business rules (enforced in src/lib/proofs.ts and src/app/api/admin/proofs)
--   • Only is_active = true proofs are returned by the public /api/proofs feed.
--   • order_code is auto-generated (#ORD-xxxx) when the admin leaves it blank.
--   • New / edited proofs appear on /proofs immediately (no-store responses).
-- ─────────────────────────────────────────────────────────────────────────────
