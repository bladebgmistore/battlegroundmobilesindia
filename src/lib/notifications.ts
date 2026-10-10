import { db } from "@/db";
import { announcements, notificationReads, orders, userNotifications, users } from "@/db/schema";
import { ensureNotificationTables } from "@/lib/notification-tables";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

/**
 * Notification & Announcement system.
 *
 * - user_notifications rows feed the header bell. `user_id = null` rows are
 *   broadcasts visible to every signed-in user.
 * - notification_reads stores per-user read state (one row per
 *   notification/user pair), so broadcasts can be "read" individually.
 * - announcements are composed by the admin and fanned out into
 *   user_notifications on publish.
 */

export type NotificationType = "order_update" | "support_reply" | "announcement";

export type AnnouncementBadge = "General" | "Offer" | "Urgent Maintenance" | "Update";

export const ANNOUNCEMENT_BADGES: AnnouncementBadge[] = ["General", "Offer", "Urgent Maintenance", "Update"];

export type NotificationRow = typeof userNotifications.$inferSelect;

export type NotificationWithRead = NotificationRow & { isRead: boolean };

/** Human-friendly label for an order status change. */
export function orderStatusLabel(status: string): string {
  switch (status) {
    case "delivered":
      return "Order Completed";
    case "cancelled":
      return "Order Cancelled";
    case "payment_confirmed":
      return "Payment Confirmed";
    case "payment_review":
      return "Payment Under Review";
    case "awaiting_contact":
      return "Awaiting Contact";
    default:
      return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

/** Insert one notification row (userId null = broadcast to everyone). */
export async function notifyUser(input: {
  userId: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  badge?: string | null;
  orderId?: string | null;
  ticketId?: string | null;
  announcementId?: string | null;
}): Promise<void> {
  await ensureNotificationTables();
  await db.insert(userNotifications).values({
    userId: input.userId,
    type: input.type,
    badge: input.badge ?? null,
    title: input.title.slice(0, 180),
    body: input.body ?? null,
    link: input.link ?? null,
    orderId: input.orderId ?? null,
    ticketId: input.ticketId ?? null,
    announcementId: input.announcementId ?? null,
  });
}

/**
 * Automated alert when an order status changes (admin updates, payment
 * confirmations…). Never throws — notifications must not break order flows.
 */
export async function notifyOrderStatusChange(order: {
  id: string;
  orderCode: string;
  userId: string | null;
  productName: string;
  status: string;
}): Promise<void> {
  if (!order.userId) return;
  await notifyUser({
    userId: order.userId,
    type: "order_update",
    title: orderStatusLabel(order.status),
    body: `Order ${order.orderCode} (${order.productName}) is now "${orderStatusLabel(order.status)}".`,
    link: "/account",
    orderId: order.id,
  });
}

/** Admin replied on a support ticket → bell alert for the buyer. */
export async function notifySupportReply(
  ticket: { id: string; orderId: string; orderCode: string; userId: string; productName: string },
  adminName: string,
): Promise<void> {
  if (!ticket.userId) return;
  await notifyUser({
    userId: ticket.userId,
    type: "support_reply",
    title: `Admin replied to Order #${ticket.orderCode}`,
    body: `${adminName} sent a new message on your support ticket for "${ticket.productName}".`,
    link: `/support?orderId=${ticket.orderId}&ticket=${ticket.id}`,
    ticketId: ticket.id,
    orderId: ticket.orderId,
  });
}

/** Notifications visible to a user (targeted + broadcasts), newest first. */
export async function listNotificationsForUser(userId: string, limit = 50): Promise<NotificationWithRead[]> {
  await ensureNotificationTables();
  const rows = await db
    .select({
      notification: userNotifications,
      isRead: sql<boolean>`EXISTS (SELECT 1 FROM ${notificationReads} r WHERE r.notification_id = ${userNotifications.id} AND r.user_id = ${userId})`,
    })
    .from(userNotifications)
    .where(or(eq(userNotifications.userId, userId), isNull(userNotifications.userId)))
    .orderBy(desc(userNotifications.createdAt))
    .limit(limit);

  return rows.map((row) => ({ ...row.notification, isRead: Boolean(row.isRead) }));
}

/** Unread count for the bell badge (targeted + unread broadcasts). */
export async function countUnreadForUser(userId: string): Promise<number> {
  await ensureNotificationTables();
  const [{ value }] = await db
    .select({ value: sql<number>`count(*)` })
    .from(userNotifications)
    .where(
      and(
        or(eq(userNotifications.userId, userId), isNull(userNotifications.userId)),
        sql`NOT EXISTS (SELECT 1 FROM ${notificationReads} r WHERE r.notification_id = ${userNotifications.id} AND r.user_id = ${userId})`,
      ),
    );
  return Number(value ?? 0);
}

/**
 * Mark notifications as read for a user.
 * - `ids`: specific notification ids.
 * - `all`: every visible notification.
 * - `ticketId`: every notification tied to one support ticket (used when the
 *   buyer opens the chat).
 */
export async function markNotificationsRead(
  userId: string,
  filter: { ids?: string[]; all?: boolean; ticketId?: string },
): Promise<number> {
  await ensureNotificationTables();

  let targetIds: string[] = [];
  if (filter.all) {
    const rows = await db
      .select({ id: userNotifications.id })
      .from(userNotifications)
      .where(or(eq(userNotifications.userId, userId), isNull(userNotifications.userId)));
    targetIds = rows.map((r) => r.id);
  } else if (filter.ticketId) {
    const rows = await db
      .select({ id: userNotifications.id })
      .from(userNotifications)
      .where(and(eq(userNotifications.ticketId, filter.ticketId), or(eq(userNotifications.userId, userId), isNull(userNotifications.userId))));
    targetIds = rows.map((r) => r.id);
  } else if (filter.ids?.length) {
    targetIds = filter.ids;
  }

  if (!targetIds.length) return 0;

  await db
    .insert(notificationReads)
    .values(targetIds.map((notificationId) => ({ notificationId, userId })))
    .onConflictDoNothing();

  return targetIds.length;
}

/**
 * Publish an admin announcement. Broadcasts insert one notification row with
 * `user_id = null` (visible to everyone); targeted announcements insert one
 * row for the specific user. Returns the announcement row.
 */
export async function createAnnouncement(input: {
  title: string;
  message: string;
  badge: AnnouncementBadge;
  target: "all" | "user";
  targetUserId?: string | null;
  targetEmail?: string | null;
  createdBy?: string | null;
}) {
  await ensureNotificationTables();

  let targetUserId = input.target === "user" ? input.targetUserId ?? null : null;
  let targetEmail = input.target === "user" ? input.targetEmail ?? null : null;

  // Resolve an email to a user id when only the email was supplied.
  if (input.target === "user" && !targetUserId && targetEmail) {
    const [row] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, targetEmail.toLowerCase()))
      .limit(1);
    if (row) {
      targetUserId = row.id;
      targetEmail = row.email;
    }
  }

  const [created] = await db
    .insert(announcements)
    .values({
      title: input.title.slice(0, 180),
      message: input.message,
      badge: input.badge,
      target: input.target,
      targetUserId,
      targetEmail,
      createdBy: input.createdBy ?? null,
    })
    .returning();

  if (created) {
    await notifyUser({
      userId: input.target === "user" ? targetUserId : null,
      type: "announcement",
      badge: input.badge,
      title: input.title,
      body: input.message,
      link: null,
      announcementId: created.id,
    }).catch((error) => console.error("Announcement notification failed:", error));
  }

  return created ?? null;
}

/** All announcements, newest first (admin broadcast log). */
export async function listAnnouncements(limit = 100) {
  await ensureNotificationTables();
  return db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(limit);
}

/** Delete an announcement + its notification rows + read markers. */
export async function deleteAnnouncement(id: string): Promise<boolean> {
  await ensureNotificationTables();
  const [row] = await db.select({ id: announcements.id }).from(announcements).where(eq(announcements.id, id)).limit(1);
  if (!row) return false;

  const linked = await db
    .select({ id: userNotifications.id })
    .from(userNotifications)
    .where(eq(userNotifications.announcementId, id));
  const linkedIds = linked.map((r) => r.id);
  if (linkedIds.length) {
    await db.delete(notificationReads).where(inArray(notificationReads.notificationId, linkedIds));
    await db.delete(userNotifications).where(inArray(userNotifications.id, linkedIds));
  }
  await db.delete(announcements).where(eq(announcements.id, id));
  return true;
}

/** Order row (id, code, user, product, status) for status-change alerts. */
export async function getOrderForNotification(orderId: string) {
  const [order] = await db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      userId: orders.userId,
      productName: orders.productName,
      status: orders.status,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return order ?? null;
}
