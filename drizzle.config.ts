import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { DATABASE_CONFIG_HINT, getDatabaseUrlDb1 } from "./src/lib/env";

/**
 * Drizzle CLI configuration — 3-database setup.
 *
 * Each Neon database has its own schema file:
 *  DB1 → src/db/schemas/db1.ts (users, auth, staff, logs)
 *  DB2 → src/db/schemas/db2.ts (inventory, products, pricing)
 *  DB3 → src/db/schemas/db3.ts (orders, proofs, referrals)
 *
 * This default config targets DB1 only. Use the per-database configs (or the
 * npm scripts) to provision all three databases:
 *
 *   npm run db:push        # DB1, then DB2, then DB3
 *   npm run db:push:db1    # drizzle.config.db1.ts
 *   npm run db:push:db2    # drizzle.config.db2.ts
 *   npm run db:push:db3    # drizzle.config.db3.ts
 */
const url = getDatabaseUrlDb1();

if (!url) {
  throw new Error(`${DATABASE_CONFIG_HINT} Required for Drizzle commands.`);
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schemas/db1.ts",
  dbCredentials: { url },
});
