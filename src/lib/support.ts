import { db } from "@/db";
import { orders, supportMessages, supportTickets, userNotifications, users } from "@/db/schema";
import { ensureSupportTables } from "@/lib/support-tables";
import { ensureNotificationTables } from "@/lib/notification-tables";
import { notifySupportReply } from "@/lib/notifications";
import { notifyAdminSupportMessage } from "@/lib/telegram";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";

/**
 * Order-based support tickets ("Chat with Admin").
 *
 * One ticket per order (order_id is unique). A ticket lives until the admin
 * clicks "Close & Resolve Ticket" — resolving PERMANENTLY deletes the ticket
 * and its entire chat history from both the user and admin dashboards.
 */

export type SupportTicketRow = typeof supportTickets.$inferSelect;
export type SupportMessageRow = typeof supportMessages.$inferSelect;

export type TicketWithMeta = SupportTicketRow & {
  unreadCount: number;
  lastMessage: string | null;
  lastMessageAt: string | Date | null;
};

/** Order shape needed to open / describe a ticket. */
export type TicketOrder = {
  id: string;
  orderCode: string;
  userId: string | null;
  customerName: string;
  productName: string;
  status: string;
};

/** Create the ticket for an order, or return the existing open one. */
export async function createOrGetTicketForOrder(order: TicketOrder, user: { id: string; name: string; email: string | null }) {
  await ensureSupportTables();

  const [existing] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.orderId, order.id))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(supportTickets)
    .values({
      orderId: order.id,
      orderCode: order.orderCode,
      userId: user.id,
      customerName: user.name || order.customerName,
      customerEmail: user.email,
      productName: order.productName,
      status: "open",
      lastMessageAt: new Date(),
    })
    .onConflictDoNothing({ target: supportTickets.orderId })
    .returning();

  if (created) {
    // A brand-new support ticket → instant Telegram alert to the admin's
    // phone (fire-and-forget — never blocks the buyer's request).
    notifyAdminSupportMessage({
      orderCode: created.orderCode,
      customerName: created.customerName ?? order.customerName,
      messageText: "Opened a new support ticket",
    });
    return created;
  }

  // Lost a race with a concurrent create — return the winner.
  const [winner] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.orderId, order.id))
    .limit(1);
  return winner ?? null;
}

/** All tickets of one user (newest activity first). */
export async function listTicketsForUser(userId: string): Promise<SupportTicketRow[]> {
  await ensureSupportTables();
  return db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, userId))
    .orderBy(desc(supportTickets.lastMessageAt), desc(supportTickets.createdAt))
    .limit(100);
}

/** Ticket lookup scoped to the owning user (null when not found / not theirs). */
export async function getTicketForUser(ticketId: string, userId: string) {
  await ensureSupportTables();
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, userId)))
    .limit(1);
  return ticket ?? null;
}

/** Ticket lookup scoped by order id + owner. */
export async function getTicketByOrderForUser(orderId: string, userId: string) {
  await ensureSupportTables();
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(and(eq(supportTickets.orderId, orderId), eq(supportTickets.userId, userId)))
    .limit(1);
  return ticket ?? null;
}

/** Ticket lookup for staff (any ticket). */
export async function getTicketForAdmin(ticketId: string) {
  await ensureSupportTables();
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1);
  return ticket ?? null;
}

/** All open tickets for the admin desk, with unread (user → admin) counts. */
export async function listTicketsForAdmin(): Promise<TicketWithMeta[]> {
  await ensureSupportTables();
  const tickets = await db
    .select()
    .from(supportTickets)
    .orderBy(desc(supportTickets.lastMessageAt), desc(supportTickets.createdAt))
    .limit(200);

  if (!tickets.length) return [];

  const ticketIds = tickets.map((t) => t.id);

  // Unread = messages sent by the customer that staff have not opened yet.
  const unreadRows = await db
    .select({ ticketId: supportMessages.ticketId, value: count() })
    .from(supportMessages)
    .where(and(inArray(supportMessages.ticketId, ticketIds), eq(supportMessages.sender, "user"), eq(supportMessages.isRead, false)))
    .groupBy(supportMessages.ticketId);
  const unreadMap = new Map(unreadRows.map((r) => [r.ticketId, Number(r.value)]));

  // Latest message preview per ticket.
  const lastRows = await db
    .select({
      ticketId: supportMessages.ticketId,
      message: supportMessages.message,
      attachmentName: supportMessages.attachmentName,
      createdAt: supportMessages.createdAt,
      rank: sql<number>`row_number() over (partition by ${supportMessages.ticketId} order by ${supportMessages.createdAt} desc)`,
    })
    .from(supportMessages)
    .where(inArray(supportMessages.ticketId, ticketIds));
  const lastMap = new Map<string, { message: string | null; at: Date | null }>();
  for (const row of lastRows) {
    if (row.rank === 1 && !lastMap.has(row.ticketId)) {
      lastMap.set(row.ticketId, {
        message: row.attachmentName ? `[Attachment] ${row.attachmentName}` : row.message,
        at: row.createdAt,
      });
    }
  }

  return tickets.map((ticket) => ({
    ...ticket,
    unreadCount: unreadMap.get(ticket.id) ?? 0,
    lastMessage: lastMap.get(ticket.id)?.message ?? null,
    lastMessageAt: lastMap.get(ticket.id)?.at ?? ticket.lastMessageAt,
  }));
}

/** Total unread user→admin messages across all open tickets (sidebar badge). */
export async function countUnreadForAdmin(): Promise<number> {
  await ensureSupportTables();
  const [{ value }] = await db
    .select({ value: count() })
    .from(supportMessages)
    .innerJoin(supportTickets, eq(supportMessages.ticketId, supportTickets.id))
    .where(and(eq(supportMessages.sender, "user"), eq(supportMessages.isRead, false), eq(supportTickets.status, "open")));
  return Number(value ?? 0);
}

export async function listMessages(ticketId: string): Promise<SupportMessageRow[]> {
  await ensureSupportTables();
  return db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.ticketId, ticketId))
    .orderBy(asc(supportMessages.createdAt), asc(supportMessages.id))
    .limit(500);
}

/**
 * Append a message to a ticket. `sender` is "user" or "admin".
 * Returns the created message, or null when the ticket no longer exists
 * (e.g. the admin just resolved & deleted it).
 */
export async function addMessage(
  ticketId: string,
  sender: "user" | "admin",
  input: {
    senderName?: string | null;
    message: string;
    attachment?: string | null;
    attachmentName?: string | null;
    attachmentType?: string | null;
  },
): Promise<SupportMessageRow | null> {
  await ensureSupportTables();
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1);
  if (!ticket) return null;

  const now = new Date();
  const [created] = await db
    .insert(supportMessages)
    .values({
      ticketId,
      sender,
      senderName: input.senderName ?? null,
      message: input.message,
      attachment: input.attachment ?? null,
      attachmentName: input.attachmentName ?? null,
      attachmentType: input.attachmentType ?? null,
      isRead: false,
      createdAt: now,
    })
    .returning();

  await db
    .update(supportTickets)
    .set({ lastMessageAt: now, updatedAt: now })
    .where(eq(supportTickets.id, ticketId));

  // Admin replied → notify the buyer (bell: "Admin replied to Order #…").
  if (sender === "admin" && created) {
    await notifySupportReply(ticket, String(input.senderName ?? "Admin")).catch((error) =>
      console.error("Support reply notification failed:", error),
    );
  }

  // Customer wrote → instant Telegram alert to the admin's phone. Covers
  // replies AND the first message on a brand-new ticket. Fire-and-forget.
  if (sender === "user" && created) {
    notifyAdminSupportMessage({
      orderCode: ticket.orderCode,
      customerName: ticket.customerName ?? input.senderName ?? "Customer",
      messageText: created.message,
    });
  }

  return created ?? null;
}

/** The buyer opened the chat → their incoming admin messages count as read. */
export async function markTicketReadByUser(ticketId: string): Promise<void> {
  await ensureSupportTables();
  await db
    .update(supportMessages)
    .set({ isRead: true })
    .where(and(eq(supportMessages.ticketId, ticketId), eq(supportMessages.sender, "admin"), eq(supportMessages.isRead, false)));
}

/** A staff member opened the ticket → customer messages count as read. */
export async function markTicketReadByAdmin(ticketId: string): Promise<void> {
  await ensureSupportTables();
  await db
    .update(supportMessages)
    .set({ isRead: true })
    .where(and(eq(supportMessages.ticketId, ticketId), eq(supportMessages.sender, "user"), eq(supportMessages.isRead, false)));
}

/**
 * "Close & Resolve Ticket" — permanently deletes the ticket AND its entire
 * chat history, so it disappears from both the user and admin dashboards.
 */
export async function resolveTicket(ticketId: string): Promise<boolean> {
  await ensureSupportTables();
  const [ticket] = await db
    .select({ id: supportTickets.id })
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1);
  if (!ticket) return false;

  await db.delete(supportMessages).where(eq(supportMessages.ticketId, ticketId));
  await db.delete(supportTickets).where(eq(supportTickets.id, ticketId));
  return true;
}

/** Snapshot of an order used to open a ticket (scoped to the owner). */
export async function getOrderForTicket(orderId: string, userId: string): Promise<TicketOrder | null> {
  const [order] = await db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      userId: orders.userId,
      customerName: orders.customerName,
      productName: orders.productName,
      status: orders.status,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);
  return order ?? null;
}

/** Fresh order snapshot for the chat header (status may have changed). */
export async function getOrderSnapshot(orderId: string) {
  const [order] = await db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      productName: orders.productName,
      status: orders.status,
      amount: orders.amount,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return order ?? null;
}

/** Resolve a user id → display record (name / email) for ticket creation. */
export async function getUserIdentity(userId: string) {
  const [row] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

/** Count open tickets (used by the admin overview). */
export async function countOpenTickets(): Promise<number> {
  await ensureSupportTables();
  const [{ value }] = await db
    .select({ value: count() })
    .from(supportTickets)
    .where(eq(supportTickets.status, "open"));
  return Number(value ?? 0);
}

/** Notification rows for a ticket (used to mark support alerts as read). */
export async function notificationIdsForTicket(ticketId: string): Promise<string[]> {
  await ensureNotificationTables();
  const rows = await db
    .select({ id: userNotifications.id })
    .from(userNotifications)
    .where(eq(userNotifications.ticketId, ticketId));
  return rows.map((r) => r.id);
}
