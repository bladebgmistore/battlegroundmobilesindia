import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

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
  verificationPaid: boolean("verification_paid").notNull().default(false),
  verificationScreenshot: text("verification_screenshot"),
  verificationPaidAt: timestamp("verification_paid_at", { withTimezone: true }),
  paymentScreenshot: text("payment_screenshot"),
  buyerIp: varchar("buyer_ip", { length: 64 }),
  buyerCity: varchar("buyer_city", { length: 120 }),
  buyerRegion: varchar("buyer_region", { length: 120 }),
  buyerCountry: varchar("buyer_country", { length: 120 }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  /**
   * false for bookkeeping copies (e.g. the OTP row created by verify-payment)
   * so one real purchase can never earn referral commission twice.
   */
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

export const feedback = pgTable("feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: varchar("type", { length: 20 }).notNull(),
  author: varchar("author", { length: 100 }),
  body: text("body").notNull(),
  rating: integer("rating"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const siteSettings = pgTable("site_settings", {
  settingKey: varchar("setting_key", { length: 80 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * @deprecated Password-based admin logins were replaced by Google Sign-In
 * (see src/lib/auth-config.ts → OWNER_EMAIL). The table is kept so existing
 * databases are not dropped by `drizzle-kit push`; nothing reads it.
 */
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

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 180 }).unique(),
  whatsapp: varchar("whatsapp", { length: 24 }).unique(),
  name: varchar("name", { length: 120 }).notNull(),
  /** Google `sub` claim — the stable unique id of the Google account. */
  googleId: varchar("google_id", { length: 64 }).unique(),
  /** Google profile photo URL. */
  avatarUrl: text("avatar_url"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  /** Legacy column: nullable now that Google is the only login method. */
  passwordHash: text("password_hash"),
  /** Unique, shareable Refer & Earn code (see src/lib/referrals.ts). */
  referralCode: varchar("referral_code", { length: 16 }).unique(),
  /** users.id of the user who referred this account (the parent). */
  referredBy: uuid("referred_by"),
  /** Spendable points: commissions credited minus redemptions (see src/lib/rewards.ts). */
  pointsBalance: integer("points_balance").notNull().default(0),
  role: varchar("role", { length: 20 }).notNull().default("customer"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Owner-managed team for the /admin area.
 * Each row grants one Google account an admin / manager / moderator role.
 * Owners are never stored here — the owner role always comes from the
 * OWNER_EMAIL environment variable (see src/lib/auth-config.ts).
 */
export const staffMembers = pgTable("staff_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Google account email of the staff member (lowercase, unique). */
  email: varchar("email", { length: 180 }).notNull().unique(),
  /** Optional display name (the Google name is used once they sign in). */
  name: varchar("name", { length: 120 }),
  /** admin | manager | moderator — see src/lib/rbac.ts */
  role: varchar("role", { length: 20 }).notNull().default("moderator"),
  isActive: boolean("is_active").notNull().default(true),
  /** Email of the owner who granted access. */
  addedBy: varchar("added_by", { length: 180 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** @deprecated Stateful customer sessions — replaced by the signed session cookie. */
export const userSessions = pgTable("user_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionToken: varchar("session_token", { length: 140 }).notNull().unique(),
  userId: uuid("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** @deprecated Password reset OTPs — unused since Google Sign-In. */
export const passwordResets = pgTable("password_resets", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 180 }).notNull(),
  otpHash: varchar("otp_hash", { length: 100 }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  isUsed: boolean("is_used").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** @deprecated Legacy stateful admin sessions — unused since Google Sign-In. */
export const adminSessions = pgTable("admin_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionToken: varchar("session_token", { length: 100 }).notNull().unique(),
  username: varchar("username", { length: 80 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("owner"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const feedbacks = pgTable("feedbacks", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  review: text("review").notNull(),
  rating: integer("rating").notNull().default(5),
  avatar: text("avatar"),
  isActive: boolean("is_active").notNull().default(true),
  /**
   * Moderation state for player-submitted reviews:
   * `pending` (awaiting admin review) | `approved` (live on the site) | `rejected`.
   * Only `approved` + `is_active` rows are returned by the public API.
   */
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  submittedByEmail: varchar("submitted_by_email", { length: 180 }),
  moderatedAt: timestamp("moderated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FeedbackStatus = "pending" | "approved" | "rejected";

/**
 * Visitor / page-view tracking log.
 * One row per page view by a signed-in user (see /api/track).
 */
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

export type CommissionStatus = "credited" | "reversed";

/**
 * Referral commission ledger — one row per confirmed purchase by a referred
 * user. `order_id` is unique, so a purchase can only ever be credited once.
 */
export const referralCommissions = pgTable("referral_commissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** users.id of the referrer who receives the points. */
  referrerId: uuid("referrer_id").notNull(),
  /** users.id of the referred buyer. */
  referredUserId: uuid("referred_user_id").notNull(),
  orderId: uuid("order_id").notNull().unique(),
  orderCode: varchar("order_code", { length: 24 }).notNull(),
  /** Amount the buyer actually paid for the order (after coupons). */
  purchaseAmount: integer("purchase_amount").notNull(),
  commissionPercent: integer("commission_percent").notNull(),
  points: integer("points").notNull(),
  /** `credited` while the order stays confirmed, `reversed` if it is cancelled / deleted. */
  status: varchar("status", { length: 16 }).notNull().default("credited"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reversedAt: timestamp("reversed_at", { withTimezone: true }),
});

/** Points store catalogue — UC packages that can be bought with points. */
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

/**
 * Order-based Support Tickets — one ticket per order, opened from the buyer's
 * "My Orders" page ("Chat with Admin"). The ticket is deleted permanently when
 * the admin clicks "Close & Resolve Ticket" (see src/lib/support.ts).
 */
export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** orders.id — unique: one open ticket per order. */
  orderId: uuid("order_id").notNull().unique(),
  orderCode: varchar("order_code", { length: 24 }).notNull(),
  /** users.id of the buyer who opened the ticket. */
  userId: uuid("user_id").notNull(),
  customerName: varchar("customer_name", { length: 120 }),
  customerEmail: varchar("customer_email", { length: 180 }),
  productName: varchar("product_name", { length: 180 }).notNull(),
  /** `open` while active; resolved tickets are deleted outright. */
  status: varchar("status", { length: 16 }).notNull().default("open"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

/**
 * Support chat messages. `sender` is `user` (the buyer) or `admin` (staff).
 * `is_read` tracks read state from the opposite side: a user message is
 * unread until an admin opens the ticket (drives the admin sidebar badge);
 * an admin message is unread until the buyer opens the chat.
 * Attachments are stored as Base64 data URLs (client-side compressed).
 */
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
 * User notifications — the header bell inbox.
 * `user_id = null` means a broadcast visible to every signed-in user.
 * `type`: order_update | support_reply | announcement.
 */
export const userNotifications = pgTable("user_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Nullable: null → broadcast to all users. */
  userId: uuid("user_id"),
  type: varchar("type", { length: 24 }).notNull(),
  /** Badge shown on the notification (General / Offer / Urgent Maintenance / Update). */
  badge: varchar("badge", { length: 32 }),
  title: varchar("title", { length: 180 }).notNull(),
  body: text("body"),
  /** Where clicking the notification navigates (e.g. /account, /support?orderId=…). */
  link: varchar("link", { length: 300 }),
  orderId: uuid("order_id"),
  ticketId: uuid("ticket_id"),
  announcementId: uuid("announcement_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Per-user read state for notifications. Broadcasts (user_id = null on the
 * notification) still need one read row per reader, so reads live in their own
 * table keyed by (notification_id, user_id).
 */
export const notificationReads = pgTable("notification_reads", {
  id: uuid("id").defaultRandom().primaryKey(),
  notificationId: uuid("notification_id").notNull(),
  userId: uuid("user_id").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Announcements / Broadcasts composed by the admin. Publishing an
 * announcement inserts a matching `user_notifications` row (broadcast →
 * user_id null; targeted → the specific user), which is what the bell reads.
 */
export const announcements = pgTable("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  message: text("message").notNull(),
  /** General | Offer | Urgent Maintenance | Update */
  badge: varchar("badge", { length: 32 }).notNull().default("General"),
  /** `all` (broadcast) or `user` (specific account). */
  target: varchar("target", { length: 12 }).notNull().default("all"),
  targetUserId: uuid("target_user_id"),
  targetEmail: varchar("target_email", { length: 180 }),
  createdBy: varchar("created_by", { length: 180 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A points → UC redemption request. Points are debited when the request is
 * created; `rejected` requests are refunded, `completed` ones are final.
 */
export const pointRedemptions = pgTable("point_redemptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  /** Reference only — the snapshot columns below keep history if the item is removed. */
  rewardId: uuid("reward_id"),
  rewardTitle: varchar("reward_title", { length: 180 }).notNull(),
  ucAmount: integer("uc_amount").notNull(),
  pointsCost: integer("points_cost").notNull(),
  /** BGMI character ID the UC must be delivered to. */
  playerUid: varchar("player_uid", { length: 64 }).notNull(),
  playerName: varchar("player_name", { length: 120 }),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  adminNote: varchar("admin_note", { length: 255 }),
  processedBy: varchar("processed_by", { length: 180 }),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Customer Proofs — verified order deliveries shown on the public /proofs page.
 *
 * Each row is one delivered order: the buyer's name, a random-looking order id
 * (#ORD-xxxx), the exact product title, the amount paid (₹) and the proof
 * image / invoice (a stored image or an uploaded Base64 screenshot).
 * `is_active = false` hides a proof from the public page without deleting it.
 */
export const customerProofs = pgTable("customer_proofs", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Indian customer name shown on the public card. */
  customerName: varchar("customer_name", { length: 120 }).notNull(),
  /** Random public order id, e.g. #ORD-4127 — unique across all proofs. */
  orderCode: varchar("order_code", { length: 24 }).notNull().unique(),
  /** Exact product title the customer bought. */
  productTitle: varchar("product_title", { length: 300 }).notNull(),
  /** Amount paid, in whole rupees. */
  amount: integer("amount").notNull(),
  /**
   * Proof image / invoice — a /public path or an uploaded Base64 data URL
   * (client-side compressed, so it stays small). Nullable: the public page
   * falls back to the shared placeholder receipt.
   */
  proofImage: text("proof_image"),
  isActive: boolean("is_active").notNull().default(true),
  /** When the order was delivered — shown on the card and used for ordering. */
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
