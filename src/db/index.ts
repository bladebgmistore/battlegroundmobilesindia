/**
 * Unified multi-database client with automatic failover.
 *
 * PRIMARY (BGMISTORE_* keys) is always tried first.
 * On connection error / timeout / quota-exceeded, the query is retried
 * automatically on SECONDARY (DATABASE2_* keys) so the site never crashes.
 *
 * Pooled vs unpooled:
 *   - `db` / `getPool()`            → pooled  (BGMISTORE_POSTGRES_PRISMA_URL etc.)
 *   - `dbUnpooled` / `getUnpooledPool()` → unpooled (BGMISTORE_DATABASE_URL_UNPOOLED etc.)
 *
 * Vercel serverless:
 *   - Lazy init — no top-level throws, build never fails if DB is missing.
 *   - globalThis caching — containers reused across invocations share clients.
 *   - Neon HTTP (fetch, no-store) for Neon hosts, pg Pool with max:3 for others.
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import {
  buildPoolConfig,
  getPrimaryPooledUrl,
  getPrimaryUnpooledUrl,
  getSecondaryPooledUrl,
  getSecondaryUnpooledUrl,
  isFailoverError,
  isNeonUrl,
  getDatabaseUrl,
  type DbRole,
} from "./config";

// Re-export helpers for consumers
export { isFailoverError, getPrimaryPooledUrl, getPrimaryUnpooledUrl, getSecondaryPooledUrl, getSecondaryUnpooledUrl, getDatabaseUrl } from "./config";
export { getDatabaseEnvSummary, isPrimaryConfigured, isSecondaryConfigured } from "./config";

type NeonSql = ReturnType<typeof neon>;
type NodeDrizzle = ReturnType<typeof drizzleNode<Record<string, never>>>;
type AnyDrizzle = NodeDrizzle & Record<string, unknown>;

// ---------------------------------------------------------------------------
// Global cache — survives HMR + Vercel container reuse
// ---------------------------------------------------------------------------

type DbGlobals = typeof globalThis & {
  // Neon SQL clients
  __bgmiNeonPooledPrimary?: NeonSql;
  __bgmiNeonPooledSecondary?: NeonSql;
  __bgmiNeonUnpooledPrimary?: NeonSql;
  __bgmiNeonUnpooledSecondary?: NeonSql;
  // pg Pools
  __bgmiPoolPooledPrimary?: Pool;
  __bgmiPoolPooledSecondary?: Pool;
  __bgmiPoolUnpooledPrimary?: Pool;
  __bgmiPoolUnpooledSecondary?: Pool;
  // Drizzle instances
  __bgmiDrizzlePooledPrimary?: AnyDrizzle;
  __bgmiDrizzlePooledSecondary?: AnyDrizzle;
  __bgmiDrizzleUnpooledPrimary?: AnyDrizzle;
  __bgmiDrizzleUnpooledSecondary?: AnyDrizzle;
  // Failover wrappers (pooled + unpooled)
  __bgmiDrizzlePooledFailover?: AnyDrizzle;
  __bgmiDrizzleUnpooledFailover?: AnyDrizzle;
};

const g = globalThis as DbGlobals;

// ---------------------------------------------------------------------------
// Low-level URL helpers (internal)
// ---------------------------------------------------------------------------

function pooledPrimaryUrl(): string | undefined {
  return getPrimaryPooledUrl();
}
function pooledSecondaryUrl(): string | undefined {
  return getSecondaryPooledUrl();
}
function unpooledPrimaryUrl(): string | undefined {
  return getPrimaryUnpooledUrl();
}
function unpooledSecondaryUrl(): string | undefined {
  return getSecondaryUnpooledUrl();
}

// ---------------------------------------------------------------------------
// Neon SQL getters (lazy, cached)
// ---------------------------------------------------------------------------

function getNeonPooledPrimary(): NeonSql | null {
  const url = pooledPrimaryUrl();
  if (!url) return null;
  if (g.__bgmiNeonPooledPrimary) return g.__bgmiNeonPooledPrimary;
  g.__bgmiNeonPooledPrimary = neon(url, { fetchOptions: { cache: "no-store" } });
  return g.__bgmiNeonPooledPrimary;
}
function getNeonPooledSecondary(): NeonSql | null {
  const url = pooledSecondaryUrl();
  if (!url) return null;
  if (g.__bgmiNeonPooledSecondary) return g.__bgmiNeonPooledSecondary;
  g.__bgmiNeonPooledSecondary = neon(url, { fetchOptions: { cache: "no-store" } });
  return g.__bgmiNeonPooledSecondary;
}
function getNeonUnpooledPrimary(): NeonSql | null {
  const url = unpooledPrimaryUrl();
  if (!url) return null;
  if (g.__bgmiNeonUnpooledPrimary) return g.__bgmiNeonUnpooledPrimary;
  g.__bgmiNeonUnpooledPrimary = neon(url, { fetchOptions: { cache: "no-store" } });
  return g.__bgmiNeonUnpooledPrimary;
}
function getNeonUnpooledSecondary(): NeonSql | null {
  const url = unpooledSecondaryUrl();
  if (!url) return null;
  if (g.__bgmiNeonUnpooledSecondary) return g.__bgmiNeonUnpooledSecondary;
  g.__bgmiNeonUnpooledSecondary = neon(url, { fetchOptions: { cache: "no-store" } });
  return g.__bgmiNeonUnpooledSecondary;
}

// ---------------------------------------------------------------------------
// Pool getters (lazy, cached)
// ---------------------------------------------------------------------------

function poolConfigFor(url: string): PoolConfig {
  return { ...buildPoolConfig(url), max: 3, idleTimeoutMillis: 20000, connectionTimeoutMillis: 10000 } as PoolConfig;
}

function getPoolPooledPrimary(): Pool | null {
  const url = pooledPrimaryUrl();
  if (!url) return null;
  if (g.__bgmiPoolPooledPrimary) return g.__bgmiPoolPooledPrimary;
  g.__bgmiPoolPooledPrimary = new Pool(poolConfigFor(url));
  return g.__bgmiPoolPooledPrimary;
}
function getPoolPooledSecondary(): Pool | null {
  const url = pooledSecondaryUrl();
  if (!url) return null;
  if (g.__bgmiPoolPooledSecondary) return g.__bgmiPoolPooledSecondary;
  g.__bgmiPoolPooledSecondary = new Pool(poolConfigFor(url));
  return g.__bgmiPoolPooledSecondary;
}
function getPoolUnpooledPrimary(): Pool | null {
  const url = unpooledPrimaryUrl();
  if (!url) return null;
  if (g.__bgmiPoolUnpooledPrimary) return g.__bgmiPoolUnpooledPrimary;
  g.__bgmiPoolUnpooledPrimary = new Pool(poolConfigFor(url));
  return g.__bgmiPoolUnpooledPrimary;
}
function getPoolUnpooledSecondary(): Pool | null {
  const url = unpooledSecondaryUrl();
  if (!url) return null;
  if (g.__bgmiPoolUnpooledSecondary) return g.__bgmiPoolUnpooledSecondary;
  g.__bgmiPoolUnpooledSecondary = new Pool(poolConfigFor(url));
  return g.__bgmiPoolUnpooledSecondary;
}

// ---------------------------------------------------------------------------
// Drizzle instance builders (internal, no failover)
// ---------------------------------------------------------------------------

function buildDrizzleForUrl(url: string): AnyDrizzle {
  if (isNeonUrl(url)) {
    const sql = neon(url, { fetchOptions: { cache: "no-store" } });
    return drizzleHttp(sql) as unknown as AnyDrizzle;
  }
  const pool = new Pool(poolConfigFor(url));
  return drizzleNode(pool as unknown as Pool) as unknown as AnyDrizzle;
}

function getDrizzlePooledPrimary(): AnyDrizzle | null {
  const url = pooledPrimaryUrl();
  if (!url) return null;
  if (g.__bgmiDrizzlePooledPrimary) return g.__bgmiDrizzlePooledPrimary;
  if (isNeonUrl(url)) {
    const sql = getNeonPooledPrimary();
    if (!sql) return null;
    g.__bgmiDrizzlePooledPrimary = drizzleHttp(sql) as unknown as AnyDrizzle;
  } else {
    const pool = getPoolPooledPrimary();
    if (!pool) return null;
    g.__bgmiDrizzlePooledPrimary = drizzleNode(pool as unknown as Pool) as unknown as AnyDrizzle;
  }
  return g.__bgmiDrizzlePooledPrimary;
}

function getDrizzlePooledSecondary(): AnyDrizzle | null {
  const url = pooledSecondaryUrl();
  if (!url) return null;
  if (g.__bgmiDrizzlePooledSecondary) return g.__bgmiDrizzlePooledSecondary;
  if (isNeonUrl(url)) {
    const sql = getNeonPooledSecondary();
    if (!sql) return null;
    g.__bgmiDrizzlePooledSecondary = drizzleHttp(sql) as unknown as AnyDrizzle;
  } else {
    const pool = getPoolPooledSecondary();
    if (!pool) return null;
    g.__bgmiDrizzlePooledSecondary = drizzleNode(pool as unknown as Pool) as unknown as AnyDrizzle;
  }
  return g.__bgmiDrizzlePooledSecondary;
}

function getDrizzleUnpooledPrimary(): AnyDrizzle | null {
  const url = unpooledPrimaryUrl();
  if (!url) return null;
  if (g.__bgmiDrizzleUnpooledPrimary) return g.__bgmiDrizzleUnpooledPrimary;
  if (isNeonUrl(url)) {
    const sql = getNeonUnpooledPrimary();
    if (!sql) return null;
    g.__bgmiDrizzleUnpooledPrimary = drizzleHttp(sql) as unknown as AnyDrizzle;
  } else {
    const pool = getPoolUnpooledPrimary();
    if (!pool) return null;
    g.__bgmiDrizzleUnpooledPrimary = drizzleNode(pool as unknown as Pool) as unknown as AnyDrizzle;
  }
  return g.__bgmiDrizzleUnpooledPrimary;
}

function getDrizzleUnpooledSecondary(): AnyDrizzle | null {
  const url = unpooledSecondaryUrl();
  if (!url) return null;
  if (g.__bgmiDrizzleUnpooledSecondary) return g.__bgmiDrizzleUnpooledSecondary;
  if (isNeonUrl(url)) {
    const sql = getNeonUnpooledSecondary();
    if (!sql) return null;
    g.__bgmiDrizzleUnpooledSecondary = drizzleHttp(sql) as unknown as AnyDrizzle;
  } else {
    const pool = getPoolUnpooledSecondary();
    if (!pool) return null;
    g.__bgmiDrizzleUnpooledSecondary = drizzleNode(pool as unknown as Pool) as unknown as AnyDrizzle;
  }
  return g.__bgmiDrizzleUnpooledSecondary;
}

// ---------------------------------------------------------------------------
// Failover wrapper — mirrors the full Drizzle chain so secondary replay is
// exact. Every top-level method (select/insert/update/delete/execute/query)
// creates a dual-chain proxy that on await retries on secondary if the
// primary throws a failover-eligible error.
// ---------------------------------------------------------------------------

function wrapDualChain(primaryChain: unknown, secondaryChain: unknown | null): unknown {
  if (!secondaryChain) return primaryChain;
  if (!primaryChain || typeof primaryChain !== "object") return primaryChain;

  // Fast path: if the chain is already a promise-like that will be awaited
  // directly, we can wrap its then without mirroring intermediate steps.
  // But most chains are builders with intermediate steps (where/orderBy/etc.),
  // so we need to mirror each call.

  const chainProxy = new Proxy(primaryChain as Record<string, unknown>, {
    get(target, prop) {
      // Handle promise interface — this is where the query actually executes
      if (prop === "then") {
        const origThen = (target as { then?: unknown }).then;
        if (typeof origThen === "function") {
          return (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
            const primaryPromise = (origThen as Function).call(
              target,
              (v: unknown) => v,
              (e: unknown) => {
                throw e;
              },
            ) as Promise<unknown>;
            return primaryPromise.then(
              (value) => (onFulfilled ? onFulfilled(value) : value),
              (err: unknown) => {
                if (isFailoverError(err) && secondaryChain) {
                  console.warn("[db] Primary query failed — failing over to secondary:", shortError(err));
                  const secThen = (secondaryChain as { then?: unknown }).then;
                  if (typeof secThen === "function") {
                    const secPromise = (secThen as Function).call(
                      secondaryChain,
                      (v: unknown) => v,
                      (e: unknown) => {
                        throw e;
                      },
                    ) as Promise<unknown>;
                    return secPromise.then(
                      (v2) => (onFulfilled ? onFulfilled(v2) : v2),
                      (e2: unknown) => (onRejected ? onRejected(e2) : Promise.reject(e2)),
                    );
                  }
                  // Secondary chain is not thenable but maybe has execute
                  return Promise.reject(err);
                }
                return onRejected ? onRejected(err) : Promise.reject(err);
              },
            );
          };
        }
      }
      if (prop === "catch") {
        return (onRejected: (e: unknown) => unknown) => {
          const thenFn = (chainProxy as { then: Function }).then;
          return (thenFn as Function)(undefined, onRejected);
        };
      }
      if (prop === "finally") {
        const origFinally = (target as { finally?: unknown }).finally;
        if (typeof origFinally === "function") {
          return (onFinally?: () => unknown) => {
            const thenFn = (chainProxy as { then: Function }).then;
            return (thenFn as Function)(
              (v: unknown) => {
                onFinally?.();
                return v;
              },
              (e: unknown) => {
                onFinally?.();
                throw e;
              },
            );
          };
        }
      }

      // Drizzle's execute() (for sql`` and explicit execute) — wrap with retry
      if (prop === "execute") {
        const origExec = (target as { execute?: unknown }).execute;
        if (typeof origExec === "function") {
          return async (...args: unknown[]) => {
            try {
              return await (origExec as Function).apply(target, args);
            } catch (e: unknown) {
              if (isFailoverError(e) && secondaryChain && typeof (secondaryChain as { execute?: unknown }).execute === "function") {
                console.warn("[db] Primary execute failed — failing over to secondary:", shortError(e));
                return await ((secondaryChain as { execute: Function }).execute as Function).apply(secondaryChain, args);
              }
              throw e;
            }
          };
        }
      }

      const val = (target as Record<string, unknown>)[prop as string];

      if (typeof val === "function") {
        return (...args: unknown[]) => {
          const primRes = (val as Function).apply(target, args);
          let secRes: unknown = null;
          if (secondaryChain && typeof (secondaryChain as Record<string, unknown>)[prop as string] === "function") {
            try {
              secRes = ((secondaryChain as Record<string, unknown>)[prop as string] as Function).apply(secondaryChain, args);
            } catch {
              // Secondary mirror may throw if secondary not configured correctly — ignore
              secRes = null;
            }
          } else {
            // If secondary chain doesn't have this method, it may be a property chain (e.g., db.query.users)
            // In that case secondaryChain[prop] may be an object, not a function
            const secVal = (secondaryChain as Record<string, unknown> | null)?.[prop as string];
            secRes = secVal ?? null;
          }

          // If the result is chainable (has where/from/orderBy/limit/then/execute etc.), keep wrapping
          if (primRes && typeof primRes === "object") {
            const isChainable =
              typeof (primRes as { then?: unknown }).then === "function" ||
              typeof (primRes as { execute?: unknown }).execute === "function" ||
              typeof (primRes as { where?: unknown }).where === "function" ||
              typeof (primRes as { from?: unknown }).from === "function" ||
              typeof (primRes as { set?: unknown }).set === "function" ||
              typeof (primRes as { values?: unknown }).values === "function" ||
              typeof (primRes as { returning?: unknown }).returning === "function";

            if (isChainable) {
              return wrapDualChain(primRes, secRes);
            }
            // Also handle relational query builder objects like db.query.users
            // They are proxy-like objects where each table accessor returns a builder
            if (secRes && typeof secRes === "object") {
              // Check if secRes looks like a query builder namespace
              // We wrap it as a dual namespace too
              return createDualNamespace(primRes as Record<string, unknown>, secRes as Record<string, unknown>);
            }
          }

          // Direct promise return — wrap its rejection for failover
          if (primRes && typeof (primRes as { then?: unknown }).then === "function" && secRes && typeof (secRes as { then?: unknown }).then === "function") {
            return (primRes as Promise<unknown>).catch((e: unknown) => {
              if (isFailoverError(e)) {
                console.warn("[db] Primary promise failed — failing over to secondary:", shortError(e));
                return secRes as Promise<unknown>;
              }
              throw e;
            });
          }

          return primRes;
        };
      }

      // Handle namespace objects like db.query (relational queries)
      if (val && typeof val === "object" && secondaryChain) {
        const secVal = (secondaryChain as Record<string, unknown>)[prop as string];
        if (secVal && typeof secVal === "object") {
          return createDualNamespace(val as Record<string, unknown>, secVal as Record<string, unknown>);
        }
      }

      return val;
    },
  });

  return chainProxy;
}

function createDualNamespace(primaryNs: Record<string, unknown>, secondaryNs: Record<string, unknown>): unknown {
  return new Proxy(primaryNs, {
    get(target, prop) {
      const primVal = target[prop as string];
      const secVal = secondaryNs[prop as string];
      if (typeof primVal === "function" && typeof secVal === "function") {
        return (...args: unknown[]) => {
          const primRes = (primVal as Function).apply(target, args);
          let secRes: unknown = null;
          try {
            secRes = (secVal as Function).apply(secondaryNs, args);
          } catch {
            secRes = null;
          }
          if (primRes && typeof primRes === "object") return wrapDualChain(primRes, secRes);
          if (primRes && typeof (primRes as { then?: unknown }).then === "function" && secRes) {
            return (primRes as Promise<unknown>).catch((e: unknown) => {
              if (isFailoverError(e)) return secRes as Promise<unknown>;
              throw e;
            });
          }
          return primRes;
        };
      }
      if (primVal && typeof primVal === "object" && secVal && typeof secVal === "object") {
        return createDualNamespace(primVal as Record<string, unknown>, secVal as Record<string, unknown>);
      }
      return primVal;
    },
  });
}

function createFailoverDrizzle(primary: AnyDrizzle | null, secondary: AnyDrizzle | null): AnyDrizzle | null {
  if (!primary && !secondary) return null;
  if (primary && !secondary) return primary;
  if (!primary && secondary) return secondary;

  // Both exist — create a proxy that mirrors every operation
  // @ts-ignore — drizzle instance is proxied for failover
  const p = primary as unknown as Record<string, unknown>;
  // @ts-ignore
  const s = secondary as unknown as Record<string, unknown>;

  // @ts-ignore — proxy needs index signature
  return new Proxy(p as unknown as AnyDrizzle, {
    get(target, prop) {
      const primVal = (target as Record<string, unknown>)[prop as string];
      const secVal = s[prop as string];

      if (typeof primVal === "function") {
        return (...args: unknown[]) => {
          let primRes: unknown;
          try {
            primRes = (primVal as Function).apply(target, args);
          } catch (e: unknown) {
            if (isFailoverError(e) && typeof secVal === "function") {
              console.warn("[db] Primary method threw — failing over:", shortError(e));
              return (secVal as Function).apply(secondary, args);
            }
            throw e;
          }

          let secRes: unknown = null;
          if (typeof secVal === "function") {
            try {
              secRes = (secVal as Function).apply(secondary, args);
            } catch {
              secRes = null;
            }
          } else if (secVal && typeof secVal === "object") {
            secRes = secVal;
          }

          // Transaction is special — it takes a callback that receives tx
          if (prop === "transaction") {
            return async (cb: (tx: unknown) => Promise<unknown>, ...rest: unknown[]) => {
              try {
                return await (primRes as Promise<unknown>);
              } catch (e: unknown) {
                // primRes for transaction is a promise that wraps the callback execution
                // Actually drizzle transaction returns a promise; we need to catch it
                // The above try/catch won't catch async rejection — we need to handle promise rejection
                // So we fall through to promise handling
              }
              // Handle promise rejection
              if (primRes && typeof (primRes as { then?: unknown }).then === "function") {
                return (primRes as Promise<unknown>).catch((e: unknown) => {
                  if (isFailoverError(e) && secRes && typeof (secRes as { then?: unknown }).then === "function") {
                    console.warn("[db] Primary transaction failed — retrying on secondary:", shortError(e));
                    return secRes as Promise<unknown>;
                  }
                  throw e;
                });
              }
              return primRes;
            };
          }

          // If result is thenable / builder, wrap with dual-chain logic
          if (primRes && typeof primRes === "object") {
            return wrapDualChain(primRes, secRes);
          }
          if (primRes && typeof (primRes as { then?: unknown }).then === "function") {
            const primPromise = primRes as Promise<unknown>;
            if (secRes && typeof (secRes as { then?: unknown }).then === "function") {
              return primPromise.catch((e: unknown) => {
                if (isFailoverError(e)) {
                  console.warn("[db] Primary async op failed — failing over:", shortError(e));
                  return secRes as Promise<unknown>;
                }
                throw e;
              });
            }
            return primPromise;
          }

          return primRes;
        };
      }

      // Handle db.query namespace (relational)
      if (primVal && typeof primVal === "object" && secVal && typeof secVal === "object") {
        return createDualNamespace(primVal as Record<string, unknown>, secVal as Record<string, unknown>);
      }

      return primVal;
    },
  }) as unknown as AnyDrizzle;
}

function shortError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.slice(0, 300);
}

// ---------------------------------------------------------------------------
// Public drizzle getters (failover-aware, cached)
// ---------------------------------------------------------------------------

function getPooledFailoverClient(): AnyDrizzle {
  if (g.__bgmiDrizzlePooledFailover) return g.__bgmiDrizzlePooledFailover;

  const primary = getDrizzlePooledPrimary();
  const secondary = getDrizzlePooledSecondary();

  if (!primary && !secondary) {
    throw new Error(
      "No pooled database URL configured — set BGMISTORE_DATABASE_URL / BGMISTORE_POSTGRES_PRISMA_URL (primary) or DATABASE2_* (secondary) or DATABASE_URL.",
    );
  }

  const failover = createFailoverDrizzle(primary, secondary);
  if (!failover) throw new Error("Failed to create pooled database client.");
  g.__bgmiDrizzlePooledFailover = failover;
  return failover;
}

function getUnpooledFailoverClient(): AnyDrizzle {
  if (g.__bgmiDrizzleUnpooledFailover) return g.__bgmiDrizzleUnpooledFailover;

  const primary = getDrizzleUnpooledPrimary();
  const secondary = getDrizzleUnpooledSecondary();

  if (!primary && !secondary) {
    // Fall back to pooled client if no unpooled URL is set (common when only one URL is provided)
    return getPooledFailoverClient();
  }

  // If secondary unpooled missing, try secondary pooled as fallback for failover
  let sec = secondary;
  if (!sec) {
    sec = getDrizzlePooledSecondary();
  }
  // If primary unpooled missing but primary pooled exists, use pooled primary
  let prim = primary;
  if (!prim) {
    prim = getDrizzlePooledPrimary();
  }

  if (!prim && !sec) throw new Error("No unpooled database URL configured.");
  const failover = createFailoverDrizzle(prim, sec);
  if (!failover) throw new Error("Failed to create unpooled database client.");
  g.__bgmiDrizzleUnpooledFailover = failover;
  return failover;
}

// ---------------------------------------------------------------------------
// Exported clients
// ---------------------------------------------------------------------------

/**
 * Primary drizzle instance (no failover) — for diagnostics or direct primary-only ops.
 * Returns null if primary is not configured.
 */
export function getPrimaryClient(opts: { unpooled?: boolean } = {}): AnyDrizzle | null {
  return opts.unpooled ? getDrizzleUnpooledPrimary() : getDrizzlePooledPrimary();
}

/**
 * Secondary drizzle instance (no failover) — for diagnostics.
 */
export function getSecondaryClient(opts: { unpooled?: boolean } = {}): AnyDrizzle | null {
  return opts.unpooled ? getDrizzleUnpooledSecondary() : getDrizzlePooledSecondary();
}

/**
 * Main failover-aware drizzle client.
 * Use this for all normal app queries — it tries primary, then secondary on infra errors.
 */
export function getDb(opts: { unpooled?: boolean } = {}): AnyDrizzle {
  return opts.unpooled ? getUnpooledFailoverClient() : getPooledFailoverClient();
}

// Backward-compatible named export: `db` is the pooled failover client.
export const db: AnyDrizzle = new Proxy({} as AnyDrizzle, {
  get(_t, prop: keyof AnyDrizzle) {
    // Lazily resolve so build doesn't fail when env is missing
    return (getPooledFailoverClient() as unknown as Record<string, unknown>)[prop as string];
  },
});

// Unpooled failover client — for migrations / admin bootstrap that need direct connection.
export const dbUnpooled: AnyDrizzle = new Proxy({} as AnyDrizzle, {
  get(_t, prop: keyof AnyDrizzle) {
    return (getUnpooledFailoverClient() as unknown as Record<string, unknown>)[prop as string];
  },
});

// Aliases for requirement example: some codebases use `lib/db.ts`
export const prisma = db;
export const drizzle = db;

// ---------------------------------------------------------------------------
// Pool / Neon raw access (for health checks, direct SQL, etc.)
// ---------------------------------------------------------------------------

/**
 * Get the pooled pg Pool (failover-aware wrapper if secondary exists).
 * For direct pool access — prefers primary, falls back to secondary on error.
 * Returns null if no pool-based URL is configured (e.g., all Neon HTTP).
 */
export function getPool(): Pool | null {
  // If either primary or secondary is a Neon URL, we use Neon HTTP — pool not needed for app queries.
  // But we still expose pools for non-Neon setups.
  const primaryUrl = pooledPrimaryUrl();
  const secondaryUrl = pooledSecondaryUrl();
  if (primaryUrl && isNeonUrl(primaryUrl)) {
    // Neon HTTP path — no pool needed, but if secondary is non-Neon we still need pool for it
    // For health checks we can return null and caller should use getNeonSqlRaw
    if (secondaryUrl && !isNeonUrl(secondaryUrl)) {
      return getPoolPooledSecondary();
    }
    return getPoolPooledPrimary();
  }
  // Non-Neon path — use pool with failover wrapper where possible
  const primary = getPoolPooledPrimary();
  const secondary = getPoolPooledSecondary();
  if (primary && secondary) {
    // Create failover wrapper pool
    return createFailoverPool(primary, secondary);
  }
  return primary ?? secondary ?? null;
}

export function getUnpooledPool(): Pool | null {
  const primaryUrl = unpooledPrimaryUrl();
  const secondaryUrl = unpooledSecondaryUrl();
  if (primaryUrl && isNeonUrl(primaryUrl)) {
    if (secondaryUrl && !isNeonUrl(secondaryUrl)) return getPoolUnpooledSecondary();
    return getPoolUnpooledPrimary();
  }
  const primary = getPoolUnpooledPrimary();
  const secondary = getPoolUnpooledSecondary();
  if (primary && secondary) return createFailoverPool(primary, secondary);
  return primary ?? secondary ?? null;
}

function createFailoverPool(primary: Pool, secondary: Pool): Pool {
  const wrapper = {
    query: async (...args: unknown[]) => {
      try {
        return await (primary.query as Function).apply(primary, args);
      } catch (e: unknown) {
        if (isFailoverError(e)) {
          console.warn("[db] Primary pool query failed — failing over to secondary:", shortError(e));
          return await (secondary.query as Function).apply(secondary, args);
        }
        throw e;
      }
    },
    connect: async (...args: unknown[]) => {
      try {
        return await (primary.connect as Function).apply(primary, args);
      } catch (e: unknown) {
        if (isFailoverError(e)) {
          console.warn("[db] Primary pool connect failed — failing over to secondary:", shortError(e));
          return await (secondary.connect as Function).apply(secondary, args);
        }
        throw e;
      }
    },
    end: async (...args: unknown[]) => {
      await Promise.allSettled([
        (primary.end as Function).apply(primary, args),
        (secondary.end as Function).apply(secondary, args),
      ]);
    },
    // @ts-ignore — failover pool wrapper
  } as unknown as Pool;

  // @ts-ignore
  return new Proxy(wrapper as unknown as Record<string, unknown>, {
    get(target, prop) {
      if (prop in target) return (target as Record<string, unknown>)[prop as string];
      const val = (primary as unknown as Record<string, unknown>)[prop as string];
      if (typeof val === "function") return (val as Function).bind(primary);
      return val;
    },
  }) as Pool;
}

/**
 * Get raw Neon SQL function (pooled by default).
 * Returns failover-aware wrapper if secondary exists; otherwise primary.
 * For direct `sql` tagged template usage outside drizzle.
 */
export function getNeonSqlRaw(opts: { unpooled?: boolean } = {}): NeonSql {
  const unpooled = opts.unpooled ?? false;
  const primaryUrl = unpooled ? unpooledPrimaryUrl() : pooledPrimaryUrl();
  const secondaryUrl = unpooled ? unpooledSecondaryUrl() : pooledSecondaryUrl();

  const primarySql = unpooled ? getNeonUnpooledPrimary() : getNeonPooledPrimary();
  const secondarySql = unpooled ? getNeonUnpooledSecondary() : getNeonPooledSecondary();

  if (!primarySql && !secondarySql) {
    throw new Error(`No Neon URL configured for ${unpooled ? "unpooled" : "pooled"} connection.`);
  }
  if (primarySql && !secondarySql) return primarySql;
  if (!primarySql && secondarySql) return secondarySql!;

  // Both exist — create failover wrapper that is callable as tagged template
  // and proxies any other properties (e.g., .query)
  const primary = primarySql!;
  const secondary = secondarySql!;

  const wrapper = async (strings: TemplateStringsArray, ...params: unknown[]) => {
    try {
      return await (primary as unknown as (s: TemplateStringsArray, ...p: unknown[]) => Promise<unknown>)(strings, ...params);
    } catch (e: unknown) {
      if (isFailoverError(e)) {
        console.warn("[db] Primary Neon SQL failed — failing over to secondary:", shortError(e));
        return await (secondary as unknown as (s: TemplateStringsArray, ...p: unknown[]) => Promise<unknown>)(strings, ...params);
      }
      throw e;
    }
  };

  // Proxy to also support sql.query(...) and other properties if present
  return new Proxy(wrapper as unknown as Record<string, unknown>, {
    get(target, prop) {
      if (prop in target) return (target as Record<string, unknown>)[prop as string];
      const primVal = (primary as unknown as Record<string, unknown>)[prop as string];
      const secVal = (secondary as unknown as Record<string, unknown>)[prop as string];
      if (typeof primVal === "function" && typeof secVal === "function") {
        return async (...args: unknown[]) => {
          try {
            return await (primVal as Function).apply(primary, args);
          } catch (e: unknown) {
            if (isFailoverError(e)) {
              console.warn("[db] Primary Neon method failed — failing over:", shortError(e));
              return await (secVal as Function).apply(secondary, args);
            }
            throw e;
          }
        };
      }
      return primVal ?? secVal;
    },
    apply(target, _thisArg, args) {
      return (target as unknown as Function).apply(null, args);
    },
  }) as unknown as NeonSql;
}

// Convenience: unpooled neon raw
export function getNeonSqlRawUnpooled(): NeonSql {
  return getNeonSqlRaw({ unpooled: true });
}

// ---------------------------------------------------------------------------
// Utilities: ping, status, withTransaction helper
// ---------------------------------------------------------------------------

export async function pingDatabase(opts: { unpooled?: boolean; role?: DbRole } = {}): Promise<boolean> {
  try {
    const client = getDb({ unpooled: opts.unpooled });
    // drizzle-orm generic ping — works for both neon and pg
    const { sql } = await import("drizzle-orm");
    await client.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

export async function pingPrimary(): Promise<boolean> {
  const primary = getPrimaryClient();
  if (!primary) return false;
  try {
    const { sql } = await import("drizzle-orm");
    await primary.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

export async function pingSecondary(): Promise<boolean> {
  const secondary = getSecondaryClient();
  if (!secondary) return false;
  try {
    const { sql } = await import("drizzle-orm");
    await secondary.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

export async function getDatabaseStatus(): Promise<{
  primary: { configured: boolean; reachable: boolean; urlPreview: string | null };
  secondary: { configured: boolean; reachable: boolean; urlPreview: string | null };
  active: "primary" | "secondary" | "none";
}> {
  const pooledPrimary = pooledPrimaryUrl();
  const pooledSecondary = pooledSecondaryUrl();
  const primaryReachable = await pingPrimary();
  const secondaryReachable = await pingSecondary();
  let active: "primary" | "secondary" | "none" = "none";
  if (primaryReachable) active = "primary";
  else if (secondaryReachable) active = "secondary";

  const mask = (u: string | undefined) => {
    if (!u) return null;
    try {
      const url = new URL(u);
      return `${url.host}/...`;
    } catch {
      return "***";
    }
  };

  return {
    primary: { configured: Boolean(pooledPrimary), reachable: primaryReachable, urlPreview: mask(pooledPrimary) },
    secondary: { configured: Boolean(pooledSecondary), reachable: secondaryReachable, urlPreview: mask(pooledSecondary) },
    active,
  };
}

/**
 * Explicit failover helper for callers that want manual control.
 * Tries `fn(primaryDb)`, on failover error retries with `fn(secondaryDb)`.
 *
 * Example:
 *   const result = await withDatabaseFailover(async (client) => {
 *     return client.select().from(users).where(eq(users.id, id));
 *   });
 */
export async function withDatabaseFailover<T>(fn: (client: AnyDrizzle) => Promise<T>): Promise<T> {
  const primary = getDrizzlePooledPrimary();
  const secondary = getDrizzlePooledSecondary();

  if (!primary && !secondary) throw new Error("No database configured.");

  if (primary) {
    try {
      return await fn(primary);
    } catch (e: unknown) {
      if (isFailoverError(e) && secondary) {
        console.warn("[db] withDatabaseFailover: primary failed, retrying on secondary:", shortError(e));
        return await fn(secondary);
      }
      throw e;
    }
  }
  // Only secondary exists
  return await fn(secondary!);
}

/**
 * Same as above but using the unpooled client (for migrations/admin).
 */
export async function withUnpooledFailover<T>(fn: (client: AnyDrizzle) => Promise<T>): Promise<T> {
  const primary = getDrizzleUnpooledPrimary() ?? getDrizzlePooledPrimary();
  const secondary = getDrizzleUnpooledSecondary() ?? getDrizzlePooledSecondary();
  if (!primary && !secondary) throw new Error("No database configured.");
  if (primary) {
    try {
      return await fn(primary);
    } catch (e: unknown) {
      if (isFailoverError(e) && secondary) {
        console.warn("[db] withUnpooledFailover: primary failed, retrying on secondary:", shortError(e));
        return await fn(secondary);
      }
      throw e;
    }
  }
  return await fn(secondary!);
}

// ---------------------------------------------------------------------------
// Legacy compatibility: old `getDatabaseUrl()` that some scripts import
// ---------------------------------------------------------------------------

/** @deprecated Use getPrimaryPooledUrl() or getDb() directly. */
export function getLegacyDatabaseUrl(): string {
  return getDatabaseUrl({ pooled: true });
}
