/**
 * DB3 — Orders, Transactions, Payment Logs, Delivery Proofs, and Referral Points
 *
 * Tables:
 *  - orders
 *  - adminPresence (live "admin is reading this chat" heartbeat)
 *  - customerMessages
 *  - referralCommissions
 *  - rewardItems
 *  - pointRedemptions
 *  - supportTickets / supportMessages
 *  - userNotifications / notificationReads / announcements
 *  - customerProofs
 */
import { boolean, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderCode: varchar("order_code", { length: 24 }).notNull().unique(),
  userId: uuid("user_id"),
  categorySlug: varchar("category_slug", { length: 48 }),
  customerName: varchar("customer_name", { length: 100 }).notNull(),
  customerWhatsapp: varchar("customer_whatsapp", { length: 24 }).notNull(),
  playerUid: varchar("player_uid", { length: 64 }),
  playerName: varchar("player_name", { length: 120 }),
  productName: varchar("product_name", { length: 180 }).notNull(),
  originalAmount: integer("original_amount").notNull().default(0),
  discountAmount: integer("discount_amount").notNull().default(0),
  couponCode: varchar("coupon_code", { length: 50 }),
  amount: integer("amount").notNull(),
  status: varchar("status", { length: 24 }).notNull().default("awaiting_contact"),
  accountLoginType: varchar("account_login_type", { length: 48 }),
  accountEmail: varchar("account_email", { length: 180 }),
  accountPassword: text("account_password"),
  otpCode: varchar("otp_code", { length: 24 }),
  /**
   * Account-order OTP lifecycle (all server-generated):
   *   none → approved   |   none → pending → approved | rejected
   * `pending` means the buyer paid the refundable verification fee and is
   * waiting for an admin to approve the request, which generates a fresh code.
   */
  otpRequestStatus: varchar("otp_request_status", { length: 16 }).notNull().default("none"),
  otpRequestedAt: timestamp("otp_requested_at", { withTimezone: true }),
  otpRequestPaid: boolean("otp_request_paid").notNull().default(false),
  otpRequestPaidAt: timestamp("otp_request_paid_at", { withTimezone: true }),
  otpIssuedAt: timestamp("otp_issued_at", { withTimezone: true }),
  verificationPaid: boolean("verification_paid").notNull().default(false),
  verificationScreenshot: text("verification_screenshot"),
  verificationPaidAt: timestamp("verification_paid_at", { withTimezone: true }),
  paymentScreenshot: text("payment_screenshot"),
  /** UPI / bank transaction reference (UTR) submitted with the payment proof. */
  transactionRef: varchar("transaction_ref", { length: 64 }),
  buyerIp: varchar("buyer_ip", { length: 64 }),
  buyerCity: varchar("buyer_city", { length: 120 }),
  buyerRegion: varchar("buyer_region", { length: 120 }),
  buyerCountry: varchar("buyer_country", { length: 120 }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  commissionable: boolean("commissionable").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customerMessages = pgTable("customer_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 24 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CommissionStatus = "credited" | "reversed";

export const referralCommissions = pgTable("referral_commissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  referrerId: uuid("referrer_id").notNull(),
  referredUserId: uuid("referred_user_id").notNull(),
  orderId: uuid("order_id").notNull().unique(),
  orderCode: varchar("order_code", { length: 24 }).notNull(),
  purchaseAmount: integer("purchase_amount").notNull(),
  commissionPercent: integer("commission_percent").notNull(),
  points: integer("points").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("credited"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reversedAt: timestamp("reversed_at", { withTimezone: true }),
});

export const rewardItems = pgTable("reward_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  ucAmount: integer("uc_amount").notNull(),
  pointsCost: integer("points_cost").notNull(),
  badge: varchar("badge", { length: 48 }),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RedemptionStatus = "pending" | "completed" | "rejected";

export const pointRedemptions = pgTable("point_redemptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  rewardId: uuid("reward_id"),
  rewardTitle: varchar("reward_title", { length: 180 }).notNull(),
  ucAmount: integer("uc_amount").notNull(),
  pointsCost: integer("points_cost").notNull(),
  playerUid: varchar("player_uid", { length: 64 }).notNull(),
  playerName: varchar("player_name", { length: 120 }),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  adminNote: varchar("admin_note", { length: 255 }),
  processedBy: varchar("processed_by", { length: 180 }),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().unique(),
  orderCode: varchar("order_code", { length: 24 }).notNull(),
  userId: uuid("user_id").notNull(),
  customerName: varchar("customer_name", { length: 120 }),
  customerEmail: varchar("customer_email", { length: 180 }),
  productName: varchar("product_name", { length: 180 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("open"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const supportMessages = pgTable("support_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id").notNull(),
  sender: varchar("sender", { length: 12 }).notNull(),
  senderName: varchar("sender_name", { length: 120 }),
  message: text("message").notNull(),
  attachment: text("attachment"),
  attachmentName: varchar("attachment_name", { length: 255 }),
  attachmentType: varchar("attachment_type", { length: 64 }),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Lightweight "is a staff member looking at the support desk right now" state.
 * The admin dashboard heartbeats every ~15s with the ticket it has open, so the
 * Telegram notifier can stay silent while a chat is being read in real time.
 */
export const adminPresence = pgTable("admin_presence", {
  email: varchar("email", { length: 180 }).primaryKey(),
  activeTicketId: uuid("active_ticket_id"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userNotifications = pgTable("user_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id"),
  type: varchar("type", { length: 24 }).notNull(),
  badge: varchar("badge", { length: 32 }),
  title: varchar("title", { length: 180 }).notNull(),
  body: text("body"),
  link: varchar("link", { length: 300 }),
  orderId: uuid("order_id"),
  ticketId: uuid("ticket_id"),
  announcementId: uuid("announcement_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationReads = pgTable("notification_reads", {
  id: uuid("id").defaultRandom().primaryKey(),
  notificationId: uuid("notification_id").notNull(),
  userId: uuid("user_id").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
});

export const announcements = pgTable("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  message: text("message").notNull(),
  badge: varchar("badge", { length: 32 }).notNull().default("General"),
  target: varchar("target", { length: 12 }).notNull().default("all"),
  targetUserId: uuid("target_user_id"),
  targetEmail: varchar("target_email", { length: 180 }),
  createdBy: varchar("created_by", { length: 180 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customerProofs = pgTable("customer_proofs", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerName: varchar("customer_name", { length: 120 }).notNull(),
  orderCode: varchar("order_code", { length: 24 }).notNull().unique(),
  productTitle: varchar("product_title", { length: 300 }).notNull(),
  amount: integer("amount").notNull(),
  proofImage: text("proof_image"),
  isActive: boolean("is_active").notNull().default(true),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
