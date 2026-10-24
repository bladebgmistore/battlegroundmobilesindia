import { after } from "next/server";
import { db3 } from "@/db";
import { supportMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAdminViewingTicket, isAnyAdminOnline } from "@/lib/admin-presence";
import { sendTelegramMessage, buildSupportMessageAlert } from "@/lib/telegram";

/**
 * Smart Telegram alerts for the support desk.
 *
 * Old behaviour: every single customer message pinged the admin's phone — even
 * while the admin was reading the chat in the dashboard.
 *
 * New behaviour:
 *   1. A staff member has the ticket open right now → NEVER alert.
 *   2. No staff online → alert immediately (nobody can have seen it).
 *   3. Staff online but the chat is not open → wait a short threshold
 *      (default 20s, override with `TELEGRAM_UNREAD_ALERT_DELAY_MS`), then:
 *        - message still unread and chat still closed → send ONE alert
 *        - message read in the meantime → stay silent
 *
 * Sends are fire-and-forget via `after()` so a Telegram outage can never delay
 * a customer's request.
 */

const MIN_DELAY_MS = 5_000;
const MAX_DELAY_MS = 120_000;
const DEFAULT_DELAY_MS = 20_000;

/** How long an unread message must stay unseen before we ping the phone. */
export const UNREAD_ALERT_DELAY_MS = (() => {
  const raw = Number(process.env.TELEGRAM_UNREAD_ALERT_DELAY_MS ?? DEFAULT_DELAY_MS);
  if (!Number.isFinite(raw)) return DEFAULT_DELAY_MS;
  return Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, Math.round(raw)));
})();

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** True when the message still exists and nobody has read it. */
async function isStillUnread(messageId: string): Promise<boolean> {
  const [row] = await db3.select({ isRead: supportMessages.isRead })
    .from(supportMessages)
    .where(eq(supportMessages.id, messageId))
    .limit(1);
  return Boolean(row) && row.isRead === false;
}

/**
 * Run `task` once the response is on the wire. Outside a request scope
 * (scripts, tests) `after()` throws — fall back to a plain promise.
 */
function inBackground(task: () => Promise<void>): void {
  try {
    after(task);
  } catch {
    void task();
  }
}

export type UnreadAlertInput = {
  /** Message row id — used to re-check the read state after the delay. */
  messageId: string;
  ticketId: string;
  orderCode: string;
  customerName: string;
  messageText: string;
};

/**
 * Decide whether a customer message should ping the admin's phone.
 *
 * Called from `addMessage`; resolves after at most two presence reads, while
 * the actual Telegram send happens in the background.
 */
export async function scheduleSupportTelegramAlert(input: UnreadAlertInput): Promise<void> {
  // The admin is literally looking at this conversation — no phone alert.
  if (await isAdminViewingTicket(input.ticketId)) return;

  const send = () =>
    sendTelegramMessage(
      buildSupportMessageAlert({
        orderCode: input.orderCode,
        customerName: input.customerName,
        messageText: input.messageText,
      }),
    );

  // Nobody in the admin area → the message cannot have been seen yet.
  if (!(await isAnyAdminOnline())) {
    inBackground(async () => {
      await send();
    });
    return;
  }

  inBackground(async () => {
    try {
      await sleep(UNREAD_ALERT_DELAY_MS);
      if (!(await isStillUnread(input.messageId))) return; // seen in real time
      if (await isAdminViewingTicket(input.ticketId)) return; // opened the chat
      await send();
    } catch (error) {
      console.error("[support-alerts] unread telegram check failed:", error);
    }
  });
}

/**
 * A brand-new ticket has no message row to re-check, so presence alone decides:
 * alert immediately when nobody is online, otherwise re-check after the delay.
 */
export async function scheduleNewTicketTelegramAlert(input: {
  ticketId: string;
  orderCode: string;
  customerName: string;
}): Promise<void> {
  if (await isAdminViewingTicket(input.ticketId)) return;

  const send = () =>
    sendTelegramMessage(
      buildSupportMessageAlert({
        orderCode: input.orderCode,
        customerName: input.customerName,
        messageText: "Opened a new support ticket",
      }),
    );

  if (!(await isAnyAdminOnline())) {
    inBackground(async () => {
      await send();
    });
    return;
  }

  inBackground(async () => {
    try {
      await sleep(UNREAD_ALERT_DELAY_MS);
      if (await isAdminViewingTicket(input.ticketId)) return;
      await send();
    } catch (error) {
      console.error("[support-alerts] new-ticket telegram check failed:", error);
    }
  });
}
