import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { DATABASE_CONFIG_HINT, getMigrationDatabaseUrl } from "./src/lib/env";

/**
 * Drizzle CLI configuration.
 *
 * Migrations and `drizzle-kit push` need a DIRECT (non-pooled) PostgreSQL
 * connection — PgBouncer in transaction mode cannot run DDL. The URL is
 * resolved centrally in `src/lib/env.ts`:
 *
 *   1. `BGMISTORE_DATABASE_URL_UNPOOLED`  (direct — preferred for migrations)
 *   2. `BGMISTORE_POSTGRES_URL_NON_POOLING`
 *   3. `BGMISTORE_DATABASE_URL`           (pooled — last resort)
 *
 * The running app itself uses the pooled `BGMISTORE_DATABASE_URL` (see
 * `src/db/index.ts`).
 */
const url = getMigrationDatabaseUrl();

if (!url) {
  throw new Error(`${DATABASE_CONFIG_HINT} Required for Drizzle commands.`);
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url,
  },
});
