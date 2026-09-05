/**
 * Client-side invoice generator for delivered orders.
 *
 * Produces a self-contained, print-ready HTML invoice in the storefront's
 * light white + blue theme. The browser's "Save as PDF" in the print dialog
 * produces the PDF version — no server round-trip or PDF library needed.
 */

import { formatINR } from "@/lib/store-data";

export type InvoiceOrder = {
  orderCode: string;
  productName: string;
  categorySlug?: string | null;
  customerName?: string | null;
  customerWhatsapp?: string | null;
  playerUid?: string | null;
  playerName?: string | null;
  amount: number;
  originalAmount?: number | null;
  discountAmount?: number | null;
  couponCode?: string | null;
  status: string;
  createdAt: string;
  paidAt?: string | null;
};

export type InvoiceStoreInfo = {
  upiId?: string;
  whatsappNumber?: string | number;
};

const STORE_NAME = "BATTLEGROUNDS MOBILE INDIA STORE";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function buildInvoiceHtml(order: InvoiceOrder, store: InvoiceStoreInfo = {}): string {
  const original = order.originalAmount && order.originalAmount > 0 ? order.originalAmount : order.amount;
  const discount = order.discountAmount ?? 0;
  const total = order.amount;
  const whatsapp = store.whatsappNumber ? String(store.whatsappNumber) : "";
  const upi = store.upiId ? String(store.upiId) : "";
  const category = order.categorySlug ? order.categorySlug.replace(/-/g, " ").toUpperCase() : "DIGITAL PRODUCT";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Invoice ${esc(order.orderCode)} · ${esc(STORE_NAME)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #eef1f6; color: #0f172a; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; padding: 24px 12px; -webkit-font-smoothing: antialiased; }
  .sheet { max-width: 760px; margin: 0 auto; background: #ffffff; border: 1px solid #dbe2ec; border-radius: 16px; box-shadow: 0 10px 30px rgba(15,40,70,.08); overflow: hidden; }
  .head { display: flex; justify-content: space-between; gap: 16px; padding: 28px 32px; border-bottom: 1px solid #dbe2ec; background: linear-gradient(90deg, #f3f8fe, #ffffff); }
  .brand { font-size: 15px; font-weight: 900; letter-spacing: .08em; color: #0f172a; }
  .brand span { color: #0f4c81; }
  .tag { margin-top: 6px; font-size: 9px; font-weight: 800; letter-spacing: .22em; color: #0f4c81; }
  .inv-badge { text-align: right; }
  .inv-badge h1 { font-size: 22px; letter-spacing: -.02em; color: #0f172a; }
  .badge { display: inline-block; margin-top: 8px; background: #dcf5e8; color: #0e9f6e; border-radius: 999px; padding: 5px 12px; font-size: 10px; font-weight: 900; letter-spacing: .14em; }
  .body { padding: 28px 32px; }
  .meta { display: flex; flex-wrap: wrap; gap: 24px; justify-content: space-between; }
  .block h3 { font-size: 9px; font-weight: 900; letter-spacing: .18em; color: #64748b; margin-bottom: 8px; }
  .block p { font-size: 13px; font-weight: 700; color: #0f172a; line-height: 1.55; }
  .block .soft { font-weight: 500; color: #64748b; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 26px; border: 1px solid #e5e8ef; border-radius: 10px; overflow: hidden; }
  table.items th { background: #f3f8fe; color: #0f4c81; font-size: 9px; font-weight: 900; letter-spacing: .15em; text-align: left; padding: 11px 14px; }
  table.items td { padding: 13px 14px; font-size: 13px; border-top: 1px solid #e5e8ef; }
  table.items td.num, table.items th.num { text-align: right; }
  .cat { display: inline-block; background: #e0eefb; color: #0f4c81; border-radius: 5px; padding: 3px 8px; font-size: 9px; font-weight: 800; letter-spacing: .12em; margin-top: 6px; }
  .totals { margin-top: 20px; margin-left: auto; width: 300px; max-width: 100%; }
  .totals .row { display: flex; justify-content: space-between; padding: 8px 2px; font-size: 13px; color: #64748b; }
  .totals .row b { color: #0f172a; }
  .totals .grand { border-top: 2px solid #0f4c81; margin-top: 6px; padding-top: 12px; font-size: 16px; font-weight: 900; color: #0f4c81; }
  .pay { margin-top: 26px; border: 1px solid #d9e4f0; background: #f8fbff; border-radius: 10px; padding: 16px 18px; font-size: 12px; color: #334155; line-height: 1.7; }
  .pay b { color: #0f172a; }
  .foot { border-top: 1px solid #dbe2ec; padding: 18px 32px; font-size: 10.5px; color: #94a3b8; text-align: center; line-height: 1.7; background: #f8fafc; }
  .toolbar { max-width: 760px; margin: 0 auto 14px; display: flex; justify-content: flex-end; gap: 8px; }
  .toolbar button { cursor: pointer; border: 1px solid #0f4c81; background: #0f4c81; color: #ffffff; border-radius: 10px; padding: 10px 18px; font-size: 11px; font-weight: 800; letter-spacing: .1em; box-shadow: 0 6px 16px rgba(15,76,129,.2); }
  .toolbar button:hover { background: #0a3557; }
  @media print {
    body { background: #ffffff; padding: 0; }
    .toolbar { display: none; }
    .sheet { border: none; border-radius: 0; box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">PRINT / SAVE AS PDF</button></div>
  <div class="sheet">
    <div class="head">
      <div>
        <p class="brand">BATTLEGROUNDS <span>MOBILE INDIA STORE</span></p>
        <p class="tag">PREMIUM BGMI DIGITAL MARKETPLACE</p>
        ${whatsapp ? `<p style="margin-top:10px;font-size:11px;color:#64748b">Support WhatsApp: <b style="color:#0f172a">+91 ${esc(whatsapp)}</b></p>` : ""}
      </div>
      <div class="inv-badge">
        <h1>INVOICE</h1>
        <span class="badge">&#10003; PRODUCT DELIVERED</span>
      </div>
    </div>
    <div class="body">
      <div class="meta">
        <div class="block">
          <h3>BILLED TO</h3>
          <p>${esc(order.customerName || "Customer")}</p>
          ${order.customerWhatsapp ? `<p class="soft">WhatsApp: +91 ${esc(order.customerWhatsapp)}</p>` : ""}
          ${order.playerUid ? `<p class="soft">BGMI UID: ${esc(order.playerUid)}</p>` : ""}
          ${order.playerName ? `<p class="soft">In-game name: ${esc(order.playerName)}</p>` : ""}
        </div>
        <div class="block">
          <h3>INVOICE DETAILS</h3>
          <p>Invoice No: <span style="font-family:monospace;color:#0f4c81">${esc(order.orderCode)}</span></p>
          <p class="soft">Invoice Date: ${fmtDate(order.createdAt)}</p>
          <p class="soft">Payment: UPI${upi ? ` · ${esc(upi)}` : ""}</p>
          ${order.paidAt ? `<p class="soft">Paid on: ${fmtDateTime(order.paidAt)}</p>` : ""}
        </div>
      </div>

      <table class="items">
        <thead>
          <tr><th>#</th><th>ITEM DESCRIPTION</th><th>CATEGORY</th><th class="num">QTY</th><th class="num">AMOUNT</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td><b>${esc(order.productName)}</b></td>
            <td><span class="cat">${esc(category)}</span></td>
            <td class="num">1</td>
            <td class="num"><b>${formatINR(original)}</b></td>
          </tr>
        </tbody>
      </table>

      <div class="totals">
        <div class="row"><span>Subtotal</span><b>${formatINR(original)}</b></div>
        ${discount > 0 ? `<div class="row"><span>Coupon discount${order.couponCode ? ` (${esc(order.couponCode)})` : ""}</span><b style="color:#0e9f6e">- ${formatINR(discount)}</b></div>` : ""}
        <div class="row grand"><span>Total Paid</span><span>${formatINR(total)}</span></div>
      </div>

      <div class="pay">
        <b>Delivery status:</b> Product delivered and order completed on ${fmtDateTime(order.createdAt)}.<br />
        This is a computer-generated invoice for a digital product purchased on ${esc(STORE_NAME)}.
        No physical goods were shipped. For any billing question, contact support on WhatsApp${whatsapp ? ` at +91 ${esc(whatsapp)}` : ""}.
      </div>
    </div>
    <div class="foot">
 ${esc(STORE_NAME)} · COMMUNITY MARKETPLACE<br />
      Independent BGMI digital marketplace. Not affiliated with or endorsed by Krafton or BGMI.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Saves the invoice as a file AND opens the print view (Save as PDF).
 * If the browser blocks the pop-up, the downloaded file still works —
 * it can be opened and printed anytime.
 */
export function downloadInvoice(order: InvoiceOrder, store: InvoiceStoreInfo = {}): void {
  const html = buildInvoiceHtml(order, store);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `Invoice-${order.orderCode}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Also open the print view (Save as PDF). With a direct user click this is
  // allowed; if a browser blocks it, the downloaded file above still works.
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
