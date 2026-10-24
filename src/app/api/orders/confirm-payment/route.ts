import { db3 } from "@/db";
import { orders } from "@/db/schema";
import { resolveBuyerLocation } from "@/lib/geo";
import { ensureOrderColumns } from "@/lib/order-columns";
import { demoGetOrderByCode, demoUpdateOrder } from "@/lib/demo-orders";
import { notifyOrderStatusChange } from "@/lib/notifications";
import { generateOtpCode } from "@/lib/otp";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Payment confirmation endpoint.
 *
 * POST { orderCode, screenshot? , markPaid? }
 *  - `screenshot`: compressed Base64 data-URL produced client-side (< 2 MB
 *    guaranteed by the browser compressor). Stored directly on the order row,
 *    so no external storage account is required and no CORS is involved
 *    (same-origin API).
 *  - `markPaid`: flips the order into "payment_review" and stamps `paid_at`.
 *
 * The route re-captures the buyer IP + location automatically in case the
 * original order insert happened before geo data was available.
 */

// ~2 MB binary ≈ 2.8 MB Base64. Hard ceiling keeps us far away from any
// serverless payload limit (Netlify/Vercel allow ~5-6 MB) → no HTTP 413.
const MAX_SCREENSHOT_CHARS = 2_900_000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const orderCode = String(body?.orderCode ?? "").trim().slice(0, 24);
    const screenshot = typeof body?.screenshot === "string" ? body.screenshot : null;
    const markPaid = body?.markPaid === true;
    // UPI / bank reference (UTR) typed by the buyer — shown in the admin desks.
    const transactionRef = typeof body?.transactionId === "string"
      ? body.transactionId.trim().replace(/[^A-Za-z0-9]/g, "").slice(0, 64) || null
      : null;

    if (!orderCode) {
      return Response.json({ ok: false, error: "Missing order reference." }, { status: 400 });
    }

    if (screenshot) {
      if (!/^data:image\/(png|jpe?g|webp);base64,/.test(screenshot)) {
        return Response.json({ ok: false, error: "Only PNG, JPG or WEBP screenshots are supported." }, { status: 400 });
      }
      if (screenshot.length > MAX_SCREENSHOT_CHARS) {
        return Response.json(
          { ok: false, error: "Screenshot is too large even after compression. Please upload a smaller image." },
          { status: 400 },
        );
      }
    }

    if (!screenshot && !markPaid && !transactionRef) {
      return Response.json({ ok: false, error: "Nothing to update." }, { status: 400 });
    }

    const geo = await resolveBuyerLocation(request);

    try {
      await ensureOrderColumns();
      const [existing] = await db3.select({
        id: orders.id,
        buyerIp: orders.buyerIp,
        status: orders.status,
        categorySlug: orders.categorySlug,
        otpCode: orders.otpCode,
      })
        .from(orders)
        .where(eq(orders.orderCode, orderCode))
        .limit(1);

      if (!existing) {
        // Order row was never saved (DB was offline at checkout) — degrade
        // gracefully so the buyer flow is never interrupted.
        return Response.json({ ok: true, saved: false, message: "Order not found in database; confirmation recorded locally." });
      }

      const patch: Partial<typeof orders.$inferInsert> = {};
      if (screenshot) patch.paymentScreenshot = screenshot;
      if (transactionRef) patch.transactionRef = transactionRef;
      if (markPaid) {
        patch.status = "payment_review";
        patch.paidAt = new Date();
        // Account purchases: issue the first 6-digit OTP as soon as the buyer
        // confirms payment, so it is ready the moment credentials are added.
        // Codes are always generated server-side — never typed by staff.
        if (existing.categorySlug === "accounts" && !existing.otpCode) {
          patch.otpCode = generateOtpCode();
          patch.otpIssuedAt = new Date();
        }
      }
      if (!existing.buyerIp && geo.ip) {
        patch.buyerIp = geo.ip;
        patch.buyerCity = geo.city;
        patch.buyerRegion = geo.region;
        patch.buyerCountry = geo.country;
      }

      await db3.update(orders).set(patch).where(eq(orders.id, existing.id));
      return Response.json({ ok: true, saved: true });
    } catch {
      // Database offline — record the change on the demo order instead.
      const demoOrder = demoGetOrderByCode(orderCode);
      demoUpdateOrder(orderCode, {
        paymentScreenshot: screenshot ?? undefined,
        transactionRef: transactionRef ?? undefined,
        buyerIp: geo.ip ?? undefined,
        ...(markPaid ? { status: "payment_review", paidAt: new Date() } : {}),
        ...(markPaid && demoOrder?.categorySlug === "accounts" && !demoOrder.otpCode
          ? { otpCode: generateOtpCode(), otpIssuedAt: new Date() }
          : {}),
      });
      return Response.json({ ok: true, saved: true, demo: true });
    }
  } catch {
    return Response.json({ ok: false, error: "Could not process payment confirmation." }, { status: 500 });
  }
}
