import { after } from "next/server";

/**
 * Telegram Bot API — instant phone alerts for the store admin.
 *
 * Two key store events ping the admin's Telegram:
 *   1. A new order is placed at checkout.
 *   2. A support ticket is opened, or a customer replies on a ticket.
 *
 * Configuration (environment variables win; the store's own bot below is the
 * default so alerts work out of the box — see .env.example):
 *   TELEGRAM_BOT_TOKEN  — bot token from @BotFather
 *   ADMIN_CHAT_ID       — the admin's chat id (get it from @userinfobot)
 *
 * Every notification helper is fire-and-forget: the HTTP call is scheduled
 * with Next.js `after()` so it runs once the response is on the wire (and is
 * still guaranteed to complete on serverless hosts). Alerts can therefore
 * NEVER block or slow down checkout or chat. All failures are logged and
 * swallowed — a Telegram outage must never break a store flow.
 */

// Store defaults — overridable per environment via the env vars above.
const DEFAULT_BOT_TOKEN = "8870123992:AAG7TMwI04Rm35yNTDb9Ri0io1evlvqH21M";
const DEFAULT_ADMIN_CHAT_ID = "6109375681";

/** Telegram rejects messages longer than 4096 chars — keep a safety margin. */
const MAX_MESSAGE_CHARS = 4000;
/** Cap for interpolated order codes / product / customer names. */
const MAX_FIELD_CHARS = 500;
/** Never let a hung Telegram call stall the background task. */
const SEND_TIMEOUT_MS = 8000;

type TelegramConfig = { botToken: string; chatId: string };

function getTelegramConfig(): TelegramConfig | null {
  const botToken = (process.env.TELEGRAM_BOT_TOKEN ?? DEFAULT_BOT_TOKEN).trim();
  const chatId = (process.env.ADMIN_CHAT_ID ?? DEFAULT_ADMIN_CHAT_ID).trim();
  if (!botToken || !chatId) return null;
  return { botToken, chatId };
}

/**
 * Escape user-controlled text. `parse_mode: "HTML"` makes Telegram reject the
 * whole message on a stray `<`, `>` or `&`, so every interpolated value MUST
 * be escaped (the static template keeps its own <b> tags).
 */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Trim + cap a value so the fixed template always fits in one message. */
function cleanField(value: string | null | undefined, max: number): string {
  const text = String(value ?? "").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export type NewOrderAlert = {
  /** Human-facing order reference, e.g. "BG-XXXXXX-123". */
  orderCode: string;
  productName: string;
  /** Final amount payable (after any coupon discount), in INR. */
  amount: number;
  customerName: string;
};

/**
 * Message for event 1 — new order placed:
 * 🚨 <b>New Order Received!</b>
 *
 * <b>Order ID:</b> #{orderId}
 * <b>Product:</b> {productName}
 * <b>Amount:</b> ₹{amount}
 * <b>Customer:</b> {customerName}
 */
export function buildNewOrderAlertMessage(order: NewOrderAlert): string {
  const amount = Number.isFinite(order.amount) ? Math.round(order.amount) : 0;
  return [
    "🚨 <b>New Order Received!</b>",
    "",
    `<b>Order ID:</b> #${escapeHtml(cleanField(order.orderCode, 64))}`,
    `<b>Product:</b> ${escapeHtml(cleanField(order.productName, MAX_FIELD_CHARS))}`,
    `<b>Amount:</b> ₹${amount}`,
    `<b>Customer:</b> ${escapeHtml(cleanField(order.customerName, 100))}`,
  ].join("\n");
}

export type SupportMessageAlert = {
  /** Human-facing order reference the ticket belongs to. */
  orderCode: string;
  customerName: string;
  messageText: string;
};

/**
 * Message for event 2 — new support ticket / customer reply:
 * 💬 <b>New Support Message!</b>
 *
 * <b>Order ID:</b> #{orderId}
 * <b>Customer:</b> {customerName}
 * <b>Message:</b> {messageText}
 */
export function buildSupportMessageAlert(input: SupportMessageAlert): string {
  // Leave room for the fixed template around the customer's message.
  const messageCap = MAX_MESSAGE_CHARS - 200;
  return [
    "💬 <b>New Support Message!</b>",
    "",
    `<b>Order ID:</b> #${escapeHtml(cleanField(input.orderCode, 64))}`,
    `<b>Customer:</b> ${escapeHtml(cleanField(input.customerName, 100))}`,
    `<b>Message:</b> ${escapeHtml(cleanField(input.messageText, messageCap))}`,
  ].join("\n");
}

/**
 * POST to the Telegram Bot API `sendMessage` endpoint with HTML parse mode so
 * the bold formatting renders. Never throws — resolves false (and logs) on
 * any failure so callers can treat it as best-effort.
 */
export async function sendTelegramMessage(text: string): Promise<boolean> {
  const config = getTelegramConfig();
  if (!config) {
    console.log("[telegram] TELEGRAM_BOT_TOKEN / ADMIN_CHAT_ID not set — alert skipped");
    return false;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: text.slice(0, MAX_MESSAGE_CHARS),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`[telegram] sendMessage failed with HTTP ${response.status}: ${detail.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[telegram] sendMessage failed:", error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Dispatch one alert without ever blocking the caller: the send is scheduled
 * with Next.js `after()` so it runs after the response has been sent (and is
 * still guaranteed to complete on serverless hosts). Outside a request scope
 * (scripts, tests) `after()` throws — degrade to a plain unawaited promise.
 */
function dispatchAlert(text: string): void {
  const run = () => sendTelegramMessage(text);
  try {
    after(() => {
      void run();
    });
  } catch {
    void run();
  }
}

/** 🚨 Event 1: a new order was placed. Fire-and-forget, never throws. */
export function notifyAdminNewOrder(order: NewOrderAlert): void {
  try {
    dispatchAlert(buildNewOrderAlertMessage(order));
  } catch (error) {
    console.error("[telegram] new-order alert failed:", error);
  }
}

/** 💬 Event 2: new support ticket / customer reply. Fire-and-forget, never throws. */
export function notifyAdminSupportMessage(input: SupportMessageAlert): void {
  try {
    dispatchAlert(buildSupportMessageAlert(input));
  } catch (error) {
    console.error("[telegram] support-message alert failed:", error);
  }
}
