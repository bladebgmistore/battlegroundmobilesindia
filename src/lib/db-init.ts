/**
 * Self-healing database initialiser.
 *
 * The store used to require a one-time manual `npx drizzle-kit push` before
 * the database had any tables. If that step was skipped (or the DATABASE_URL
 * points at a brand-new Neon project), every runtime query failed and the
 * admin panel showed "Neon catalog could not be loaded" even though the
 * DATABASE_URL itself was correct.
 *
 * `ensureDbReady()` fixes that permanently:
 *   1. Creates any missing tables with `CREATE TABLE IF NOT EXISTS`
 *      (exact mirror of src/db/schema.ts — idempotent, safe to run often).
 *   2. Seeds default catalog data ONLY when the related table is empty
 *      (reuses bootstrapDatabase from src/lib/db-bootstrap.ts).
 *
 * It is memoised per server instance, never throws (failures are logged and
 * the app keeps its graceful default fallbacks), and is safe to call from any
 * route handler. It must NEVER be called from statically prerendered pages —
 * route handlers and dynamic APIs only.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { bootstrapDatabase } from "@/lib/db-bootstrap";

/** CREATE TABLE IF NOT EXISTS statements mirroring src/db/schema.ts. */
const DDL_STATEMENTS: string[] = [
  `create table if not exists "categories" (
    "id" uuid primary key default gen_random_uuid(),
    "name" varchar(100) not null,
    "slug" varchar(100) not null unique,
    "description" text,
    "image" text,
    "sort_order" integer not null default 100,
    "is_active" boolean not null default true,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now()
  )`,
  `create table if not exists "products" (
    "id" uuid primary key default gen_random_uuid(),
    "category_slug" varchar(100) not null,
    "title" varchar(180) not null,
    "price" integer not null,
    "image" text not null,
    "features" jsonb not null default '[]'::jsonb,
    "badge" varchar(48),
    "sort_order" integer not null default 0,
    "is_active" boolean not null default true,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now()
  )`,
  `create table if not exists "accounts" (
    "id" uuid primary key default gen_random_uuid(),
    "title" varchar(180) not null,
    "price" integer not null,
    "image" text not null,
    "features" jsonb not null default '[]'::jsonb,
    "badge" varchar(48),
    "is_active" boolean not null default true,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now()
  )`,
  `create table if not exists "uc_packages" (
    "id" uuid primary key default gen_random_uuid(),
    "price" integer not null,
    "uc_amount" integer not null,
    "bonus_label" varchar(80),
    "is_active" boolean not null default true,
    "created_at" timestamptz not null default now()
  )`,
  `create table if not exists "special_products" (
    "id" uuid primary key default gen_random_uuid(),
    "category" varchar(20) not null,
    "title" varchar(180) not null,
    "price" integer not null,
    "image" text not null,
    "features" jsonb not null default '[]'::jsonb,
    "badge" varchar(48),
    "sort_order" integer not null default 0,
    "is_active" boolean not null default true,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now()
  )`,
  `create table if not exists "coupons" (
    "id" uuid primary key default gen_random_uuid(),
    "code" varchar(50) not null unique,
    "discount_type" varchar(12) not null default 'percent',
    "discount_value" integer not null,
    "usage_limit" integer,
    "usage_count" integer not null default 0,
    "expires_at" timestamptz,
    "is_active" boolean not null default true,
    "created_at" timestamptz not null default now()
  )`,
  `create table if not exists "orders" (
    "id" uuid primary key default gen_random_uuid(),
    "order_code" varchar(24) not null unique,
    "user_id" uuid,
    "category_slug" varchar(48),
    "customer_name" varchar(100) not null,
    "customer_whatsapp" varchar(24) not null,
    "player_uid" varchar(64),
    "player_name" varchar(120),
    "product_name" varchar(180) not null,
    "original_amount" integer not null default 0,
    "discount_amount" integer not null default 0,
    "coupon_code" varchar(50),
    "amount" integer not null,
    "status" varchar(24) not null default 'awaiting_contact',
    "account_login_type" varchar(48),
    "account_email" varchar(180),
    "account_password" text,
    "otp_code" varchar(24),
    "verification_paid" boolean not null default false,
    "verification_screenshot" text,
    "verification_paid_at" timestamptz,
    "payment_screenshot" text,
    "buyer_ip" varchar(64),
    "buyer_city" varchar(120),
    "buyer_region" varchar(120),
    "buyer_country" varchar(120),
    "paid_at" timestamptz,
    "created_at" timestamptz not null default now()
  )`,
  `create table if not exists "customer_messages" (
    "id" uuid primary key default gen_random_uuid(),
    "name" varchar(100) not null,
    "whatsapp" varchar(24) not null,
    "message" text not null,
    "is_read" boolean not null default false,
    "created_at" timestamptz not null default now()
  )`,
  `create table if not exists "feedback" (
    "id" uuid primary key default gen_random_uuid(),
    "type" varchar(20) not null,
    "author" varchar(100),
    "body" text not null,
    "rating" integer,
    "is_active" boolean not null default true,
    "created_at" timestamptz not null default now()
  )`,
  `create table if not exists "site_settings" (
    "setting_key" varchar(80) primary key,
    "value" jsonb not null,
    "updated_at" timestamptz not null default now()
  )`,
  `create table if not exists "admins" (
    "id" uuid primary key default gen_random_uuid(),
    "username" varchar(80) not null unique,
    "email" varchar(180) not null,
    "password_hash" text not null,
    "role" varchar(20) not null default 'admin',
    "is_active" boolean not null default true,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now()
  )`,
  `create table if not exists "password_resets" (
    "id" uuid primary key default gen_random_uuid(),
    "email" varchar(180) not null,
    "otp_hash" varchar(100) not null,
    "attempts" integer not null default 0,
    "is_used" boolean not null default false,
    "expires_at" timestamptz not null,
    "created_at" timestamptz not null default now()
  )`,
  `create table if not exists "users" (
    "id" uuid primary key default gen_random_uuid(),
    "email" varchar(180) unique,
    "whatsapp" varchar(24) unique,
    "name" varchar(120) not null,
    "password_hash" text not null,
    "role" varchar(20) not null default 'customer',
    "is_active" boolean not null default true,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now()
  )`,
  `create table if not exists "user_sessions" (
    "id" uuid primary key default gen_random_uuid(),
    "session_token" varchar(140) not null unique,
    "user_id" uuid not null,
    "expires_at" timestamptz not null,
    "created_at" timestamptz not null default now()
  )`,
  `create table if not exists "admin_sessions" (
    "id" uuid primary key default gen_random_uuid(),
    "session_token" varchar(100) not null unique,
    "username" varchar(80) not null,
    "role" varchar(20) not null default 'owner',
    "expires_at" timestamptz not null,
    "created_at" timestamptz not null default now()
  )`,
  `create table if not exists "feedbacks" (
    "id" uuid primary key default gen_random_uuid(),
    "name" varchar(120) not null,
    "review" text not null,
    "rating" integer not null default 5,
    "avatar" text,
    "is_active" boolean not null default true,
    "created_at" timestamptz not null default now(),
    "updated_at" timestamptz not null default now()
  )`,
];

type DbWithExecute = {
  execute: (query: unknown) => Promise<unknown>;
};

type InitGlobals = typeof globalThis & {
  __bgmiDbReady?: Promise<void>;
};

const g = globalThis as InitGlobals;

async function ensureSchema(): Promise<void> {
  const runner = db as unknown as DbWithExecute;
  const combined = DDL_STATEMENTS.join(";\n");
  try {
    await runner.execute(sql.raw(combined));
    return;
  } catch (combinedError) {
    // Some drivers reject multi-statement strings — run them one by one.
    console.warn("db-init: combined DDL failed, retrying per statement.", String((combinedError as Error)?.message ?? combinedError).slice(0, 300));
  }
  for (const statement of DDL_STATEMENTS) {
    try {
      await runner.execute(sql.raw(statement));
    } catch (statementError) {
      console.error("db-init: create table failed:", String((statementError as Error)?.message ?? statementError).slice(0, 500));
      throw statementError;
    }
  }
}

/**
 * Ensure tables exist and default seed data is present. Memoised, non-throwing.
 * Call `await ensureDbReady()` at the start of dynamic route handlers.
 */
export function ensureDbReady(): Promise<void> {
  if (!g.__bgmiDbReady) {
    g.__bgmiDbReady = (async () => {
      try {
        await ensureSchema();
        await bootstrapDatabase();
        console.log("db-init: schema ensured + seed data verified.");
      } catch (error) {
        console.error("db-init: automatic setup incomplete (app will use fallbacks):", error);
      }
    })();
  }
  return g.__bgmiDbReady;
}
