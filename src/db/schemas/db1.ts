/**
 * DB1 — Primary User Accounts, Authentication, User Profiles, Roles/Permissions
 *
 * Tables:
 *  - users
 *  - admins (deprecated legacy)
 *  - staffMembers
 *  - userSessions (deprecated stateful sessions)
 *  - passwordResets (deprecated OTP)
 *  - adminSessions (deprecated legacy)
 *  - siteLogs (visitor/page-view tracking)
 */
import { boolean, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 180 }).unique(),
  whatsapp: varchar("whatsapp", { length: 24 }).unique(),
  name: varchar("name", { length: 120 }).notNull(),
  googleId: varchar("google_id", { length: 64 }).unique(),
  avatarUrl: text("avatar_url"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  passwordHash: text("password_hash"),
  referralCode: varchar("referral_code", { length: 16 }).unique(),
  referredBy: uuid("referred_by"),
  pointsBalance: integer("points_balance").notNull().default(0),
  role: varchar("role", { length: 20 }).notNull().default("customer"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const admins = pgTable("admins", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 80 }).notNull().unique(),
  email: varchar("email", { length: 180 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 20 }).notNull().default("admin"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const staffMembers = pgTable("staff_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 180 }).notNull().unique(),
  name: varchar("name", { length: 120 }),
  role: varchar("role", { length: 20 }).notNull().default("moderator"),
  isActive: boolean("is_active").notNull().default(true),
  addedBy: varchar("added_by", { length: 180 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userSessions = pgTable("user_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionToken: varchar("session_token", { length: 140 }).notNull().unique(),
  userId: uuid("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const passwordResets = pgTable("password_resets", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 180 }).notNull(),
  otpHash: varchar("otp_hash", { length: 100 }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  isUsed: boolean("is_used").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminSessions = pgTable("admin_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionToken: varchar("session_token", { length: 100 }).notNull().unique(),
  username: varchar("username", { length: 80 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("owner"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const siteLogs = pgTable("site_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id"),
  userEmail: varchar("user_email", { length: 180 }),
  userName: varchar("user_name", { length: 120 }),
  ipAddress: varchar("ip_address", { length: 64 }),
  pageUrl: text("page_url").notNull(),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  country: varchar("country", { length: 120 }),
  city: varchar("city", { length: 120 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
