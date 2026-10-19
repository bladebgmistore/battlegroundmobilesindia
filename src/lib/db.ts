/**
 * Unified database client alias — satisfies requirement for `lib/db.ts`.
 * Re-exports the failover-aware client from `@/db`.
 *
 * Primary (BGMISTORE_* keys) is tried first; on connection/timeout/quota error
 * the query is retried on Secondary (DATABASE2_* keys).
 *
 * Pooled vs unpooled:
 *   - `db`         → pooled  (BGMISTORE_POSTGRES_PRISMA_URL / BGMISTORE_POSTGRES_URL / ...)
 *   - `dbUnpooled` → unpooled (BGMISTORE_DATABASE_URL_UNPOOLED / BGMISTORE_POSTGRES_URL_NON_POOLING / ...)
 */
export {
  db,
  dbUnpooled,
  prisma,
  drizzle,
  getDb,
  getPrimaryClient,
  getSecondaryClient,
  getPool,
  getUnpooledPool,
  getNeonSqlRaw,
  getNeonSqlRawUnpooled,
  pingDatabase,
  pingPrimary,
  pingSecondary,
  getDatabaseStatus,
  withDatabaseFailover,
  withUnpooledFailover,
  isFailoverError,
  getDatabaseEnvSummary,
  isPrimaryConfigured,
  isSecondaryConfigured,
} from "@/db";

// Also re-export config helpers for consumers needing raw URLs
export {
  getPrimaryPooledUrl,
  getPrimaryUnpooledUrl,
  getSecondaryPooledUrl,
  getSecondaryUnpooledUrl,
  getDatabaseUrl,
  isNeonUrl,
  buildPoolConfig,
} from "@/db/config";
