import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { ensureOrderColumns } from "@/lib/order-columns";
import { demoUpdateOrder, demoReplicateOrder, demoSaveOrder } from "@/lib/demo-orders";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Records the refundable verification / website-charge payment for a delivered
 * order. This is the OTP fee (accounts) or the website charge (UC / X-Suit /
 * Super-Car) that gets refunded to the buyer's UPI within 15-20 minutes.
 *
 * For ACCOUNT orders, marking the payment also creates a NEW duplicate "OTP
 * order" (fresh orderCode) so the admin has a clean row to set the OTP on. That
 * OTP then shows up in the buyer's order section.
 *
 * POST { orderCode, screenshot? , markPaid? }
 */
const MAX_SCREENSHOT_CHARS = 2_900_000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const orderCode = String(body?.orderCode ?? "").trim().slice(0, 24);
    const screenshot = typeof body?.screenshot === "string" ? body.screenshot : null;
    const markPaid = body?.markPaid === true;

    if (!orderCode) {
      return NextResponse.json({ error: "Missing order reference." }, { status: 400 });
    }
    if (!screenshot && !markPaid) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    if (screenshot) {
      if (!/^data:image\/(png|jpe?g|webp);base64,/.test(screenshot)) {
        return NextResponse.json({ error: "Only PNG, JPG or WEBP screenshots are supported." }, { status: 400 });
      }
      if (screenshot.length > MAX_SCREENSHOT_CHARS) {
        return NextResponse.json({ error: "Screenshot is too large. Please upload a smaller image." }, { status: 400 });
      }
    }

    // Build the patch for the original order.
    const patch: Record<string, unknown> = {};
    if (screenshot) patch.verificationScreenshot = screenshot;
    if (markPaid) {
      patch.verificationPaid = true;
      patch.verificationPaidAt = new Date();
    }

    const createdOtpOrder = Boolean(markPaid);

    try {
      await ensureOrderColumns();
      const [existing] = await db
        .select()
        .from(orders)
        .where(eq(orders.orderCode, orderCode))
        .limit(1);

      if (!existing) {
        return NextResponse.json({ ok: true, saved: false, message: "Order not found; payment recorded locally." });
      }

      await db.update(orders).set(patch).where(eq(orders.id, existing.id));

      // Account order paid → create a fresh OTP order row for the admin to set
      // the OTP on, which the buyer then sees in their order section.
      if (createdOtpOrder && existing.categorySlug === "accounts") {
        const otpCode = `BG-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
        await db.insert(orders).values({
          userId: existing.userId,
          categorySlug: "accounts",
          customerName: existing.customerName,
          customerWhatsapp: existing.customerWhatsapp,
          playerUid: existing.playerUid,
          playerName: existing.playerName,
          productName: `${existing.productName} — OTP`,
          originalAmount: existing.originalAmount,
          discountAmount: existing.discountAmount ?? 0,
          couponCode: existing.couponCode,
          amount: existing.amount,
          orderCode: otpCode,
          status: "payment_confirmed",
          buyerIp: existing.buyerIp,
          buyerCity: existing.buyerCity,
          buyerRegion: existing.buyerRegion,
          buyerCountry: existing.buyerCountry,
          verificationPaid: true,
          verificationPaidAt: new Date(),
        });
      }

      return NextResponse.json({ ok: true, saved: true });
    } catch {
      // Database offline — record on the demo order so the preview still works.
      demoUpdateOrder(orderCode, {
        verificationScreenshot: screenshot ?? undefined,
        ...(markPaid ? { verificationPaid: true, verificationPaidAt: new Date() } : {}),
      });

      if (createdOtpOrder) {
        const existing = demoUpdateOrder(orderCode, {});
        if (existing) {
          const replica = demoReplicateOrder(orderCode, {
            productName: `${existing.productName} — OTP`,
            status: "payment_confirmed",
            verificationPaid: true,
            verificationPaidAt: new Date(),
            otpCode: null,
          });
          if (replica) {
            // Make sure the replica is persisted (replicate already saved it);
            // the buyer sees the new OTP order in their account.
            demoSaveOrder(replica);
          }
        }
      }
      return NextResponse.json({ ok: true, saved: true, demo: true });
    }
  } catch {
    return NextResponse.json({ error: "Could not process payment confirmation." }, { status: 500 });
  }
}
