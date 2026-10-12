/**
 * Generates sql/005_customer_proofs.sql — the canonical migration for the
 * Customer Proofs feature — with the pre-loaded seed rows taken verbatim
 * from src/lib/proof-seed.ts (single source of truth for titles & prices).
 *
 * Run with:  npx tsx scripts/generate-proofs-sql.ts
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PROOF_SEED, proofImageFor } from "../src/lib/proof-seed";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const esc = (value: string) => value.replace(/'/g, "''");

const values = PROOF_SEED.map(
  (seed) =>
    `  ('${esc(seed.customerName)}', '${esc(seed.orderCode)}', '${esc(seed.productTitle)}', ${seed.amount}, '${proofImageFor(seed.orderCode)}', true, '${seed.deliveredAt}'::timestamptz, ${seed.sortOrder})`,
).join(",\n");

const sql = `-- ============================================================================
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
${values}
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
`;

writeFileSync(join(root, "sql", "005_customer_proofs.sql"), sql);
console.log(`wrote sql/005_customer_proofs.sql (${PROOF_SEED.length} seeded proofs)`);
