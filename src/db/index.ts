/**
 * Centralized 3-database client — Neon HTTP for Neon, node-postgres otherwise.
 *
 * Partition:
 *  db1 (DATABASE_URL_DB1) — User Accounts, Auth, Profiles, Roles/Permissions
 *  db2 (DATABASE_URL_DB2) — Store Inventory, Products, Categories, Pricing
 *  db3 (DATABASE_URL_DB3) — Orders, Transactions, Proofs, Referral Points
 *
 * Each client is created lazily so `next build` never fails without credentials.
 * The legacy `db` export is removed — import db1/db2/db3 explicitly.
 */
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import {
  requireDatabaseUrlDb1,
  requireDatabaseUrlDb2,
  requireDatabaseUrlDb3,
} from "@/lib/env";

type NeonSql = ReturnType<typeof neon>;
type NodeDrizzle = ReturnType<typeof drizzleNode<Record<string, never>>>;
type AnyDrizzle = NodeDrizzle;

type DbGlobals = typeof globalThis & {
  __bgmiNeonSql1?: NeonSql;
  __bgmiNeonSql2?: NeonSql;
  __bgmiNeonSql3?: NeonSql;
  __bgmiPool1?: Pool;
  __bgmiPool2?: Pool;
  __bgmiPool3?: Pool;
  __bgmiDrizzle1?: AnyDrizzle;
  __bgmiDrizzle2?: AnyDrizzle;
  __bgmiDrizzle3?: AnyDrizzle;
};

const g = globalThis as DbGlobals;

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

// ── Pools ──────────────────────────────────────────────────────────────────

export function getPool1(): Pool {
  if (g.__bgmiPool1) return g.__bgmiPool1;
  g.__bgmiPool1 = new Pool({
    ...buildPoolConfig(requireDatabaseUrlDb1()),
    max: 3,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 10000,
  });
  return g.__bgmiPool1;
}
export function getPool2(): Pool {
  if (g.__bgmiPool2) return g.__bgmiPool2;
  g.__bgmiPool2 = new Pool({
    ...buildPoolConfig(requireDatabaseUrlDb2()),
    max: 3,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 10000,
  });
  return g.__bgmiPool2;
}
export function getPool3(): Pool {
  if (g.__bgmiPool3) return g.__bgmiPool3;
  g.__bgmiPool3 = new Pool({
    ...buildPoolConfig(requireDatabaseUrlDb3()),
    max: 3,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 10000,
  });
  return g.__bgmiPool3;
}

// ── Neon SQL ────────────────────────────────────────────────────────────────

function getNeonSql1(): NeonSql {
  if (g.__bgmiNeonSql1) return g.__bgmiNeonSql1;
  g.__bgmiNeonSql1 = neon(requireDatabaseUrlDb1(), { fetchOptions: { cache: "no-store" } });
  return g.__bgmiNeonSql1;
}
function getNeonSql2(): NeonSql {
  if (g.__bgmiNeonSql2) return g.__bgmiNeonSql2;
  g.__bgmiNeonSql2 = neon(requireDatabaseUrlDb2(), { fetchOptions: { cache: "no-store" } });
  return g.__bgmiNeonSql2;
}
function getNeonSql3(): NeonSql {
  if (g.__bgmiNeonSql3) return g.__bgmiNeonSql3;
  g.__bgmiNeonSql3 = neon(requireDatabaseUrlDb3(), { fetchOptions: { cache: "no-store" } });
  return g.__bgmiNeonSql3;
}

// ── Drizzle clients ────────────────────────────────────────────────────────

function getClient1(): AnyDrizzle {
  if (g.__bgmiDrizzle1) return g.__bgmiDrizzle1;
  const url = requireDatabaseUrlDb1();
  const client = isNeonUrl(url)
    ? (drizzleHttp(getNeonSql1()) as unknown as AnyDrizzle)
    : (drizzleNode(getPool1()) as unknown as AnyDrizzle);
  if (process.env.NODE_ENV !== "production") g.__bgmiDrizzle1 = client;
  return client;
}
function getClient2(): AnyDrizzle {
  if (g.__bgmiDrizzle2) return g.__bgmiDrizzle2;
  const url = requireDatabaseUrlDb2();
  const client = isNeonUrl(url)
    ? (drizzleHttp(getNeonSql2()) as unknown as AnyDrizzle)
    : (drizzleNode(getPool2()) as unknown as AnyDrizzle);
  if (process.env.NODE_ENV !== "production") g.__bgmiDrizzle2 = client;
  return client;
}
function getClient3(): AnyDrizzle {
  if (g.__bgmiDrizzle3) return g.__bgmiDrizzle3;
  const url = requireDatabaseUrlDb3();
  const client = isNeonUrl(url)
    ? (drizzleHttp(getNeonSql3()) as unknown as AnyDrizzle)
    : (drizzleNode(getPool3()) as unknown as AnyDrizzle);
  if (process.env.NODE_ENV !== "production") g.__bgmiDrizzle3 = client;
  return client;
}

// ── Exported instances ─────────────────────────────────────────────────────

export const db1 = new Proxy({} as AnyDrizzle, {
  get(_t, prop: keyof AnyDrizzle) {
    // @ts-ignore
    return getClient1()[prop];
  },
});

export const db2 = new Proxy({} as AnyDrizzle, {
  get(_t, prop: keyof AnyDrizzle) {
    // @ts-ignore
    return getClient2()[prop];
  },
});

export const db3 = new Proxy({} as AnyDrizzle, {
  get(_t, prop: keyof AnyDrizzle) {
    // @ts-ignore
    return getClient3()[prop];
  },
});

// ── Helpers ────────────────────────────────────────────────────────────────

// For drizzle-kit config and advanced usage
export function getNeonSqlDb1(): NeonSql {
  return getNeonSql1();
}
export function getNeonSqlDb2(): NeonSql {
  return getNeonSql2();
}
export function getNeonSqlDb3(): NeonSql {
  return getNeonSql3();
}
// Ping helpers
export async function pingDatabaseDb1(): Promise<boolean> {
  try {
    const url = requireDatabaseUrlDb1();
    if (isNeonUrl(url)) await getNeonSql1()`select 1`;
    else {
      const c = await getPool1().connect();
      try { await c.query("select 1"); } finally { c.release(); }
    }
    return true;
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn("[db1] ping failed:", e);
    return false;
  }
}
export async function pingDatabaseDb2(): Promise<boolean> {
  try {
    const url = requireDatabaseUrlDb2();
    if (isNeonUrl(url)) await getNeonSql2()`select 1`;
    else {
      const c = await getPool2().connect();
      try { await c.query("select 1"); } finally { c.release(); }
    }
    return true;
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn("[db2] ping failed:", e);
    return false;
  }
}
export async function pingDatabaseDb3(): Promise<boolean> {
  try {
    const url = requireDatabaseUrlDb3();
    if (isNeonUrl(url)) await getNeonSql3()`select 1`;
    else {
      const c = await getPool3().connect();
      try { await c.query("select 1"); } finally { c.release(); }
    }
    return true;
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn("[db3] ping failed:", e);
    return false;
  }
}

export async function pingAllDatabases(): Promise<{ db1: boolean; db2: boolean; db3: boolean }> {
  const [db1Ok, db2Ok, db3Ok] = await Promise.all([pingDatabaseDb1(), pingDatabaseDb2(), pingDatabaseDb3()]);
  return { db1: db1Ok, db2: db2Ok, db3: db3Ok };
}
