import { db } from "@/db";
import { coupons, orders } from "@/db/schema";
import { getAdminSession } from "@/lib/admin-auth";
import { resolveBuyerLocation } from "@/lib/geo";
import { ensureOrderColumns } from "@/lib/order-columns";
import { desc, eq, inArray } from "drizzle-orm";
import { ensureDbReady } from "@/lib/db-init";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function computeCoupon(amount: number, coupon: { discountType: string; discountValue: number }) {
  const discountAmount = coupon.discountType === "flat"
    ? Math.min(amount, coupon.discountValue)
    : Math.min(amount, Math.round((amount * coupon.discountValue) / 100));
  return { discountAmount, finalAmount: Math.max(0, amount - discountAmount) };
}

export async function POST(request: NextRequest) {
  await ensureDbReady();
  try {
    const body = await request.json();
    const customerName = String(body.customerName ?? "Website visitor").trim().slice(0, 100);
    const customerWhatsapp = String(body.customerWhatsapp ?? "Not supplied").trim().slice(0, 24);
    const playerUid = String(body.playerUid ?? "").trim().slice(0, 64) || null;
    const playerName = String(body.playerName ?? "").trim().slice(0, 120) || null;
    const productName = String(body.productName ?? "Selected product").trim().slice(0, 180);
    const originalAmount = Number(body.baseAmount ?? body.amount ?? 0);
    const couponCode = String(body.couponCode ?? "").trim().toUpperCase() || null;
    if (!productName || !Number.isFinite(originalAmount) || originalAmount <= 0) {
      return Response.json({ error: "Invalid order details" }, { status: 400 });
    }

    let discountAmount = 0;
    let finalAmount = originalAmount;

    if (couponCode) {
      try {
        const [coupon] = await db.select().from(coupons).where(eq(coupons.code, couponCode)).limit(1);
        if (!coupon || !coupon.isActive) {
          return Response.json({ error: "Invalid or disabled coupon." }, { status: 400 });
        }
        if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
          return Response.json({ error: "Coupon has expired." }, { status: 400 });
        }
        if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
          return Response.json({ error: "Coupon usage limit reached." }, { status: 400 });
        }
        const calculated = computeCoupon(originalAmount, coupon);
        discountAmount = calculated.discountAmount;
        finalAmount = calculated.finalAmount;
        await db.update(coupons).set({ usageCount: coupon.usageCount + 1 }).where(eq(coupons.id, coupon.id));
      } catch {
        return Response.json({ error: "Could not validate coupon right now." }, { status: 503 });
      }
    }

    // Automatic buyer IP + location trace — fully server-side, never blocks.
    const geo = await resolveBuyerLocation(request);

    const orderCode = `BG-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    try {
      await ensureOrderColumns();
      await db.insert(orders).values({
        customerName,
        customerWhatsapp,
        playerUid,
        playerName,
        productName,
        originalAmount,
        discountAmount,
        couponCode,
        amount: finalAmount,
        orderCode,
        buyerIp: geo.ip,
        buyerCity: geo.city,
        buyerRegion: geo.region,
        buyerCountry: geo.country,
      });
    } catch {
      // Still return a code so WhatsApp/payment handoff works even if DB is offline.
      return Response.json({ orderCode, finalAmount, discountAmount, couponCode, playerUid, saved: false }, { status: 201 });
    }
    return Response.json({ orderCode, finalAmount, discountAmount, couponCode, playerUid, saved: true }, { status: 201 });
  } catch {
    return Response.json({ error: "Could not register your request" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (!(await getAdminSession(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await ensureDbReady();
  await ensureDbReady();
  await ensureDbReady();
  try {
    await ensureOrderColumns();
    const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(100);
    return Response.json({ orders: rows });
  } catch {
    return Response.json({ orders: [], databaseOffline: true });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await getAdminSession(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, status } = await request.json();
    const allowed = ["awaiting_contact", "payment_review", "payment_confirmed", "delivered", "cancelled"];
    if (!id || !allowed.includes(String(status))) {
      return Response.json({ error: "Invalid order status." }, { status: 400 });
    }
    await db.update(orders).set({ status: String(status) }).where(eq(orders.id, String(id)));
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not update order status." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await getAdminSession(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, ids } = await request.json();
    const selectedIds = Array.isArray(ids) ? ids.map(String).filter(Boolean) : id ? [String(id)] : [];
    if (!selectedIds.length) return Response.json({ error: "Select at least one order." }, { status: 400 });
    if (selectedIds.length === 1) await db.delete(orders).where(eq(orders.id, selectedIds[0]));
    else await db.delete(orders).where(inArray(orders.id, selectedIds));
    return Response.json({ ok: true, deleted: selectedIds.length });
  } catch {
    return Response.json({ error: "Could not delete order." }, { status: 500 });
  }
}
