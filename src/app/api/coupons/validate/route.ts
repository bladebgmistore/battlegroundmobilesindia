import { db } from "@/db";
import { coupons } from "@/db/schema";
import { eq } from "drizzle-orm";
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
    const { code, amount } = await request.json();
    const cleanCode = String(code ?? "").trim().toUpperCase();
    const numericAmount = Number(amount ?? 0);
    if (!cleanCode || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return Response.json({ error: "Coupon code and amount are required." }, { status: 400 });
    }

    const [coupon] = await db.select().from(coupons).where(eq(coupons.code, cleanCode)).limit(1);
    if (!coupon || !coupon.isActive) {
      return Response.json({ valid: false, error: "Invalid or disabled coupon." }, { status: 404 });
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return Response.json({ valid: false, error: "This coupon has expired." }, { status: 400 });
    }
    if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
      return Response.json({ valid: false, error: "This coupon has reached its usage limit." }, { status: 400 });
    }

    const result = computeCoupon(numericAmount, coupon);
    return Response.json({
      valid: true,
      code: cleanCode,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      ...result,
    });
  } catch {
    return Response.json({ error: "Could not validate coupon." }, { status: 500 });
  }
}
