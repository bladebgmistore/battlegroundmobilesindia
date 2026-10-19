/**
 * Notification & Announcement system — 3-database aware.
 * DB1: users (for email→id resolution)
 * DB3: orders, announcements, userNotifications, notificationReads
 */
import { db1, db3 } from "@/db";
import { announcements, notificationReads, orders, userNotifications, users } from "@/db/schema";
import { ensureNotificationTables } from "@/lib/notification-tables";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

export type NotificationType = "order_update" | "support_reply" | "announcement";
export type AnnouncementBadge = "General" | "Offer" | "Urgent Maintenance" | "Update";
export const ANNOUNCEMENT_BADGES: AnnouncementBadge[] = ["General", "Offer", "Urgent Maintenance", "Update"];
export type NotificationRow = typeof userNotifications.$inferSelect;
export type NotificationWithRead = NotificationRow & { isRead: boolean };

export function orderStatusLabel(status: string): string {
  switch (status) {
    case "delivered": return "Order Completed";
    case "cancelled": return "Order Cancelled";
    case "payment_confirmed": return "Payment Confirmed";
    case "payment_review": return "Payment Under Review";
    case "awaiting_contact": return "Awaiting Contact";
    default: return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

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
  await db3.insert(userNotifications).values({
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

export async function notifyOrderStatusChange(order: { id: string; orderCode: string; userId: string | null; productName: string; status: string }): Promise<void> {
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

export async function listNotificationsForUser(userId: string, limit = 50): Promise<NotificationWithRead[]> {
  await ensureNotificationTables();
  const rows = await db3.select({
      notification: userNotifications,
      isRead: sql<boolean>`EXISTS (SELECT 1 FROM ${notificationReads} r WHERE r.notification_id = ${userNotifications.id} AND r.user_id = ${userId})`,
    })
    .from(userNotifications)
    .where(or(eq(userNotifications.userId, userId), isNull(userNotifications.userId)))
    .orderBy(desc(userNotifications.createdAt))
    .limit(limit);
  return rows.map((row) => ({ ...row.notification, isRead: Boolean(row.isRead) }));
}

export async function countUnreadForUser(userId: string): Promise<number> {
  await ensureNotificationTables();
  const [{ value }] = await db3.select({ value: sql<number>`count(*)` })
    .from(userNotifications)
    .where(
      and(
        or(eq(userNotifications.userId, userId), isNull(userNotifications.userId)),
        sql`NOT EXISTS (SELECT 1 FROM ${notificationReads} r WHERE r.notification_id = ${userNotifications.id} AND r.user_id = ${userId})`,
      ),
    );
  return Number(value ?? 0);
}

export async function markNotificationsRead(
  userId: string,
  filter: { ids?: string[]; all?: boolean; ticketId?: string },
): Promise<number> {
  await ensureNotificationTables();
  let targetIds: string[] = [];
  if (filter.all) {
    const rows = await db3.select({ id: userNotifications.id })
      .from(userNotifications)
      .where(or(eq(userNotifications.userId, userId), isNull(userNotifications.userId)));
    targetIds = rows.map((r) => r.id);
  } else if (filter.ticketId) {
    const rows = await db3.select({ id: userNotifications.id })
      .from(userNotifications)
      .where(and(eq(userNotifications.ticketId, filter.ticketId), or(eq(userNotifications.userId, userId), isNull(userNotifications.userId))));
    targetIds = rows.map((r) => r.id);
  } else if (filter.ids?.length) {
    targetIds = filter.ids;
  }
  if (!targetIds.length) return 0;
  await db3.insert(notificationReads).values(targetIds.map((notificationId) => ({ notificationId, userId }))).onConflictDoNothing();
  return targetIds.length;
}

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
  if (input.target === "user" && !targetUserId && targetEmail) {
    const [row] = await db1.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, targetEmail.toLowerCase())).limit(1);
    if (row) {
      targetUserId = row.id;
      targetEmail = row.email;
    }
  }
  const [created] = await db3.insert(announcements)
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

export async function listAnnouncements(limit = 100) {
  await ensureNotificationTables();
  return db3.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(limit);
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  await ensureNotificationTables();
  const [row] = await db3.select({ id: announcements.id }).from(announcements).where(eq(announcements.id, id)).limit(1);
  if (!row) return false;
  const linked = await db3.select({ id: userNotifications.id }).from(userNotifications).where(eq(userNotifications.announcementId, id));
  const linkedIds = linked.map((r) => r.id);
  if (linkedIds.length) {
    await db3.delete(notificationReads).where(inArray(notificationReads.notificationId, linkedIds));
    await db3.delete(userNotifications).where(inArray(userNotifications.id, linkedIds));
  }
  await db3.delete(announcements).where(eq(announcements.id, id));
  return true;
}

export async function getOrderForNotification(orderId: string) {
  const [order] = await db3.select({ id: orders.id, orderCode: orders.orderCode, userId: orders.userId, productName: orders.productName, status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return order ?? null;
}
