/**
 * DB2 — Store Inventory, Products, Categories, Items, and Pricing data
 *
 * Tables:
 *  - categories
 *  - products
 *  - accounts
 *  - ucPackages
 *  - specialProducts
 *  - pages
 *  - coupons
 *  - siteSettings
 *  - feedbacks / feedback
 */
import { boolean, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  image: text("image"),
  sortOrder: integer("sort_order").notNull().default(100),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  categorySlug: varchar("category_slug", { length: 100 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  price: integer("price").notNull(),
  image: text("image").notNull(),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  badge: varchar("badge", { length: 48 }),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  price: integer("price").notNull(),
  image: text("image").notNull(),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  badge: varchar("badge", { length: 48 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ucPackages = pgTable("uc_packages", {
  id: uuid("id").defaultRandom().primaryKey(),
  price: integer("price").notNull(),
  ucAmount: integer("uc_amount").notNull(),
  bonusLabel: varchar("bonus_label", { length: 80 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const specialProducts = pgTable("special_products", {
  id: uuid("id").defaultRandom().primaryKey(),
  category: varchar("category", { length: 20 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  price: integer("price").notNull(),
  image: text("image").notNull(),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  badge: varchar("badge", { length: 48 }),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * CMS pages — rendered at `/pages/[slug]`.
 *
 * Kept separate from `categories` on purpose: a page is editorial content,
 * not a product filter, so creating one can never leak into the store
 * catalog navigation.
 */
export const pages = pgTable("pages", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  content: text("content").notNull().default(""),
  image: text("image"),
  showInNav: boolean("show_in_nav").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(100),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const coupons = pgTable("coupons", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  discountType: varchar("discount_type", { length: 12 }).notNull().default("percent"),
  discountValue: integer("discount_value").notNull(),
  usageLimit: integer("usage_limit"),
  usageCount: integer("usage_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const siteSettings = pgTable("site_settings", {
  settingKey: varchar("setting_key", { length: 80 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const feedback = pgTable("feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: varchar("type", { length: 20 }).notNull(),
  author: varchar("author", { length: 100 }),
  body: text("body").notNull(),
  rating: integer("rating"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const feedbacks = pgTable("feedbacks", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  review: text("review").notNull(),
  rating: integer("rating").notNull().default(5),
  avatar: text("avatar"),
  isActive: boolean("is_active").notNull().default(true),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  submittedByEmail: varchar("submitted_by_email", { length: 180 }),
  moderatedAt: timestamp("moderated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FeedbackStatus = "pending" | "approved" | "rejected";
