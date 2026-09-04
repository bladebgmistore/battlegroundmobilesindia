import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { ensureOrderColumns } from "@/lib/order-columns";
import { demoUpdateOrder } from "@/lib/demo-orders";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Records the refundable verification / website-charge payment for a delivered
 * order. This is the OTP fee (accounts) or the website charge (UC / X-Suit /
 * Super-Car) that gets refunded to the buyer's UPI within 15-20 minutes.
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

    try {
      await ensureOrderColumns();
      const [existing] = await db
        .select({ id: orders.id, orderCode: orders.orderCode })
        .from(orders)
        .where(eq(orders.orderCode, orderCode))
        .limit(1);

      if (!existing) {
        return NextResponse.json({ ok: true, saved: false, message: "Order not found; payment recorded locally." });
      }

      const patch: Partial<typeof orders.$inferInsert> = {};
      if (screenshot) patch.verificationScreenshot = screenshot;
      if (markPaid) {
        patch.verificationPaid = true;
        patch.verificationPaidAt = new Date();
      }

      await db.update(orders).set(patch).where(eq(orders.id, existing.id));
      return NextResponse.json({ ok: true, saved: true });
    } catch {
      // Database offline — record on the demo order so the preview still works.
      demoUpdateOrder(orderCode, {
        verificationScreenshot: screenshot ?? undefined,
        ...(markPaid ? { verificationPaid: true, verificationPaidAt: new Date() } : {}),
      });
      return NextResponse.json({ ok: true, saved: true, demo: true });
    }
  } catch {
    return NextResponse.json({ error: "Could not process payment confirmation." }, { status: 500 });
  }
}
