import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit needs a DIRECT (unpooled) connection for migrations.
 * We resolve it in priority order:
 *   1. BGMISTORE_DATABASE_URL_UNPOOLED  (primary direct)
 *   2. BGMISTORE_POSTGRES_URL_NON_POOLING
 *   3. DATABASE2_DATABASE_URL_UNPOOLED (secondary direct — if primary is down)
 *   4. DATABASE2_POSTGRES_URL_NON_POOLING
 *   5. BGMISTORE_POSTGRES_PRISMA_URL / BGMISTORE_DATABASE_URL (pooled fallback)
 *   6. DATABASE_URL (legacy single-DB / local dev)
 */

function pickUrl(): string {
  const candidates = [
    process.env.BGMISTORE_DATABASE_URL_UNPOOLED,
    process.env.BGMISTORE_POSTGRES_URL_NON_POOLING,
    // Secondary direct as fallback if primary is misconfigured
    process.env.DATABASE2_DATABASE_URL_UNPOOLED,
    process.env.DATABASE2_POSTGRES_URL_NON_POOLING,
    // Primary pooled as fallback (works for most Neon setups, but prefer direct)
    process.env.BGMISTORE_POSTGRES_PRISMA_URL,
    process.env.BGMISTORE_POSTGRES_URL,
    process.env.BGMISTORE_DATABASE_URL,
    // Generic fallbacks / single-DB
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
  ];
  for (const c of candidates) {
    const v = c?.trim();
    if (v) return v;
  }
  throw new Error(
    "DATABASE_URL is required for Drizzle commands — set BGMISTORE_DATABASE_URL_UNPOOLED or BGMISTORE_POSTGRES_URL_NON_POOLING (primary, unpooled) or DATABASE_URL as fallback.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url: pickUrl(),
  },
});
