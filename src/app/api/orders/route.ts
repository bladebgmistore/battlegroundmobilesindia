import { db2, db3 } from "@/db";
import { coupons, orders } from "@/db/schema";
import { isOwner, requireAdminScope } from "@/lib/admin-auth";
import { getCurrentUser } from "@/lib/user-store";
import { resolveBuyerLocation } from "@/lib/geo";
import { ensureOrderColumns } from "@/lib/order-columns";
import { demoSaveOrder, demoUpdateOrder, demoListAllOrders, demoDeleteOrders } from "@/lib/demo-orders";
import { syncReferralCommissions } from "@/lib/referrals";
import { getOrderForNotification, notifyOrderStatusChange } from "@/lib/notifications";
import { notifyAdminNewOrder } from "@/lib/telegram";
import { desc, eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function computeCoupon(amount: number, coupon: { discountType: string; discountValue: number }) {
  const discountAmount = coupon.discountType === "flat"
    ? Math.min(amount, coupon.discountValue)
    : Math.min(amount, Math.round((amount * coupon.discountValue) / 100));
  return { discountAmount, finalAmount: Math.max(0, amount - discountAmount) };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const customerName = String(body.customerName ?? "Website visitor").trim().slice(0, 100);
    const customerWhatsapp = String(body.customerWhatsapp ?? "Not supplied").trim().slice(0, 24);
    const playerUid = String(body.playerUid ?? "").trim().slice(0, 64) || null;
    const playerName = String(body.playerName ?? "").trim().slice(0, 120) || null;
    const productName = String(body.productName ?? "Selected product").trim().slice(0, 180);
    const categorySlug = String(body.categorySlug ?? "").trim().slice(0, 48) || null;
    const originalAmount = Number(body.baseAmount ?? body.amount ?? 0);
    const couponCode = String(body.couponCode ?? "").trim().toUpperCase() || null;
    if (!productName || !Number.isFinite(originalAmount) || originalAmount <= 0) {
      return Response.json({ error: "Invalid order details" }, { status: 400 });
    }
    let userId: string;
    try {
      const current = await getCurrentUser(request);
      if (!current) {
        return Response.json({ error: "Please sign in with your account to place an order." }, { status: 401 });
      }
      userId = current.id;
    } catch {
      return Response.json({ error: "Please sign in with your account to place an order." }, { status: 401 });
    }

    let discountAmount = 0;
    let finalAmount = originalAmount;

    if (couponCode) {
      try {
        const [coupon] = await db2.select().from(coupons).where(eq(coupons.code, couponCode)).limit(1);
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
        await db2.update(coupons).set({ usageCount: coupon.usageCount + 1 }).where(eq(coupons.id, coupon.id));
      } catch {
        return Response.json({ error: "Could not validate coupon right now." }, { status: 503 });
      }
    }

    const geo = await resolveBuyerLocation(request);
    const orderCode = `BG-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    try {
      await ensureOrderColumns();
      await db3.insert(orders).values({
        userId, categorySlug, customerName, customerWhatsapp, playerUid, playerName, productName,
        originalAmount, discountAmount, couponCode, amount: finalAmount, orderCode,
        buyerIp: geo.ip, buyerCity: geo.city, buyerRegion: geo.region, buyerCountry: geo.country,
      });
      notifyAdminNewOrder({ orderCode, productName, amount: finalAmount, customerName });
      return Response.json({ orderCode, finalAmount, discountAmount, couponCode, playerUid, saved: true }, { status: 201 });
    } catch {
      demoSaveOrder({
        id: `demo_${Date.now().toString(36)}_${Math.floor(100 + Math.random() * 900)}`,
        orderCode, userId, categorySlug, customerName, customerWhatsapp, playerUid, playerName, productName,
        originalAmount, discountAmount, couponCode, amount: finalAmount, status: "awaiting_contact",
        buyerIp: geo.ip, buyerCity: geo.city, buyerRegion: geo.region, buyerCountry: geo.country, createdAt: new Date(),
      });
      notifyAdminNewOrder({ orderCode, productName, amount: finalAmount, customerName });
      return Response.json({ orderCode, finalAmount, discountAmount, couponCode, playerUid, saved: false, demo: true }, { status: 201 });
    }
  } catch {
    return Response.json({ error: "Could not register your request" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (!(await requireAdminScope(request, "orders"))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureOrderColumns();
    const rows = await db3.select().from(orders).orderBy(desc(orders.createdAt)).limit(100);
    return Response.json({ orders: rows });
  } catch {
    return Response.json({ orders: demoListAllOrders(), databaseOffline: true });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAdminScope(request, "orders"))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const { id, status } = body;
    const allowed = ["awaiting_contact", "payment_review", "payment_confirmed", "delivered", "cancelled"];
    if (!id || (status && !allowed.includes(String(status)))) {
      return Response.json({ error: "Invalid order status." }, { status: 400 });
    }
    const patch: Partial<typeof orders.$inferInsert> = {};
    if (status) patch.status = String(status);
    if (body.accountLoginType !== undefined) patch.accountLoginType = String(body.accountLoginType ?? "").trim().slice(0, 48) || null;
    if (body.accountEmail !== undefined) patch.accountEmail = String(body.accountEmail ?? "").trim().slice(0, 180) || null;
    if (body.accountPassword !== undefined) patch.accountPassword = String(body.accountPassword ?? "").trim() || null;
    if (body.otpCode !== undefined) patch.otpCode = String(body.otpCode ?? "").trim().slice(0, 24) || null;
    if (!Object.keys(patch).length) {
      return Response.json({ error: "Nothing to update." }, { status: 400 });
    }
    try {
      await ensureOrderColumns();
      let previousStatus: string | null = null;
      if (status) {
        const [current] = await db3.select({ status: orders.status }).from(orders).where(eq(orders.id, String(id))).limit(1);
        previousStatus = current?.status ?? null;
      }
      await db3.update(orders).set(patch).where(eq(orders.id, String(id)));
      if (status) {
        await syncReferralCommissions({ orderId: String(id) }).catch((error) => console.error("Referral commission sync failed:", error));
      }
      if (status && previousStatus && previousStatus !== String(status)) {
        const order = await getOrderForNotification(String(id));
        if (order) {
          await notifyOrderStatusChange(order).catch((error) => console.error("Order status notification failed:", error));
        }
      }
      return Response.json({ ok: true });
    } catch {
      const patched = demoUpdateOrder(String(id), patch);
      if (!patched) {
        const match = demoListAllOrders().find((o) => o.id === id);
        if (match) demoUpdateOrder(match.orderCode, patch);
      }
      return Response.json({ ok: true, demo: true });
    }
  } catch {
    return Response.json({ error: "Could not update order status." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const identity = await requireAdminScope(request, "orders");
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isOwner(request))) {
    return Response.json({ error: "Only the owner can delete orders." }, { status: 403 });
  }
  try {
    const { id, ids } = await request.json();
    const selectedIds = Array.isArray(ids) ? ids.map(String).filter(Boolean) : id ? [String(id)] : [];
    if (!selectedIds.length) return Response.json({ error: "Select at least one order." }, { status: 400 });
    try {
      if (selectedIds.length === 1) await db3.delete(orders).where(eq(orders.id, selectedIds[0]));
      else await db3.delete(orders).where(inArray(orders.id, selectedIds));
      await syncReferralCommissions().catch((error) => console.error("Referral commission sync failed:", error));
    } catch {
      demoListAllOrders()
        .filter((o) => selectedIds.includes(o.id) || selectedIds.includes(o.orderCode))
        .forEach((o) => demoDeleteOrders([o.orderCode]));
    }
    return Response.json({ ok: true, deleted: selectedIds.length });
  } catch {
    return Response.json({ error: "Could not delete order." }, { status: 500 });
  }
}
