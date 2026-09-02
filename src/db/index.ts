/**
 * Hybrid database client — Neon HTTP for Neon, node-postgres for local.
 * Lazy so build never fails.
 */
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

type NeonSql = ReturnType<typeof neon>;
type NodeDrizzle = ReturnType<typeof drizzleNode<Record<string, never>>>;
type AnyDrizzle = NodeDrizzle;

type DbGlobals = typeof globalThis & {
  __bgmiNeonSql?: NeonSql;
  __bgmiPool?: Pool;
  __bgmiDrizzle?: AnyDrizzle;
};

const g = globalThis as DbGlobals;

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required — set it in env.");
  return url;
}

function isNeonUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h.includes("neon.tech") || h.endsWith(".neon.db");
  } catch {
    return url.includes("neon.tech");
  }
}

function buildPoolConfig(connectionString: string): PoolConfig {
  try {
    const u = new URL(connectionString);
    const needsSsl = u.searchParams.has("sslmode") || u.hostname.includes("neon.tech");
    u.searchParams.delete("sslmode");
    const clean = u.toString();
    return needsSsl ? { connectionString: clean, ssl: { rejectUnauthorized: false } } : { connectionString: clean };
  } catch {
    return { connectionString };
  }
}

export function getPool(): Pool {
  if (g.__bgmiPool) return g.__bgmiPool;
  g.__bgmiPool = new Pool({ ...buildPoolConfig(getDatabaseUrl()), max: 3, idleTimeoutMillis: 20000, connectionTimeoutMillis: 10000 });
  return g.__bgmiPool;
}

function getNeonSql(): NeonSql {
  if (g.__bgmiNeonSql) return g.__bgmiNeonSql;
  g.__bgmiNeonSql = neon(getDatabaseUrl(), { fetchOptions: { cache: "no-store" } });
  return g.__bgmiNeonSql;
}

function getClient(): AnyDrizzle {
  if (g.__bgmiDrizzle) return g.__bgmiDrizzle;
  const url = getDatabaseUrl();
  const client = isNeonUrl(url) ? (drizzleHttp(getNeonSql()) as unknown as AnyDrizzle) : (drizzleNode(getPool()) as unknown as AnyDrizzle);
  if (process.env.NODE_ENV !== "production") g.__bgmiDrizzle = client;
  return client;
}

export const db = new Proxy({} as AnyDrizzle, {
  get(_t, prop: keyof AnyDrizzle) {
    // @ts-ignore
    return getClient()[prop];
  },
});

export function getNeonSqlRaw(): NeonSql {
  return getNeonSql();
}

export async function pingDatabase(): Promise<boolean> {
  try {
    const url = getDatabaseUrl();
    if (isNeonUrl(url)) {
      await getNeonSql()`select 1`;
    } else {
      const c = await getPool().connect();
      try { await c.query("select 1"); } finally { c.release(); }
    }
    return true;
  } catch { return false; }
}
