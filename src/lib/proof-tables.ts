import { db2, db3 } from "@/db";
import { customerProofs, siteSettings } from "@/db/schema";
import { count, eq, sql } from "drizzle-orm";
import { PROOF_SEED, proofImageFor } from "@/lib/proof-seed";

/**
 * Bootstrap for Customer Proofs (DB3) + seed marker in site_settings (DB2)
 */
type G = typeof globalThis & { __bgmiProofTablesReady?: Promise<boolean> };
const SEED_MARKER = "customer_proofs_seeded";
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS customer_proofs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name varchar(120) NOT NULL,
    order_code varchar(24) NOT NULL,
    product_title varchar(300) NOT NULL,
    amount integer NOT NULL,
    proof_image text,
    is_active boolean NOT NULL DEFAULT true,
    delivered_at timestamptz,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS customer_proofs_order_code_unique ON customer_proofs (order_code)`,
  `CREATE INDEX IF NOT EXISTS customer_proofs_public_idx ON customer_proofs (is_active, delivered_at DESC, created_at DESC)`,
];

async function seedDefaultProofsOnce(): Promise<void> {
  const [marker] = await db2.select({ key: siteSettings.settingKey }).from(siteSettings).where(eq(siteSettings.settingKey, SEED_MARKER)).limit(1);
  if (marker) return;
  const [{ value: existing }] = await db3.select({ value: count() }).from(customerProofs);
  if (Number(existing) === 0) {
    await db3.insert(customerProofs).values(
      PROOF_SEED.map((seed) => ({
        customerName: seed.customerName,
        orderCode: seed.orderCode,
        productTitle: seed.productTitle,
        amount: seed.amount,
        proofImage: proofImageFor(seed.orderCode),
        isActive: true,
        deliveredAt: new Date(seed.deliveredAt),
        sortOrder: seed.sortOrder,
      })),
    );
  }
  await db2.insert(siteSettings).values({ settingKey: SEED_MARKER, value: true }).onConflictDoNothing();
}

export function ensureProofTables(): Promise<boolean> {
  const g = globalThis as G;
  if (g.__bgmiProofTablesReady) return g.__bgmiProofTablesReady;
  g.__bgmiProofTablesReady = (async () => {
    try {
      for (const statement of STATEMENTS) {
        await db3.execute(sql.raw(statement));
      }
    } catch {
      g.__bgmiProofTablesReady = undefined;
      return false;
    }
    try { await seedDefaultProofsOnce(); } catch {}
    return true;
  })();
  return g.__bgmiProofTablesReady;
}
