import { NextResponse, type NextRequest } from "next/server";
import { db3 } from "@/db";
import { orders } from "@/db/schema";
import { requireAdminScope } from "@/lib/admin-auth";
import { ensureOrderColumns } from "@/lib/order-columns";
import { demoListAllOrders, demoUpdateOrder } from "@/lib/demo-orders";
import { notifyUser } from "@/lib/notifications";
import { generateOtpCode } from "@/lib/otp";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Admin "Account Orders" desk.
 *
 * Account-store purchases get their own entry here (instead of being mixed
 * into the generic Orders table) and show the account ID + password, the
 * CURRENT active 6-digit OTP, the OTP request status and the payment state.
 *
 * GET  /api/admin/account-orders             → all account orders (newest first)
 * PATCH /api/admin/account-orders            → OTP request actions
 *   { id, action: "approve_otp" | "reject_otp" | "generate_otp" }
 *
 * Approving a request ALWAYS generates a brand-new random 6-digit code on the
 * server — the admin never types an OTP.
 */

const ACCOUNT_CATEGORY = "accounts";

export async function GET(request: NextRequest) {
  if (!(await requireAdminScope(request, "orders"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureOrderColumns();
    const rows = await db3.select()
      .from(orders)
      .where(eq(orders.categorySlug, ACCOUNT_CATEGORY))
      .orderBy(desc(orders.createdAt))
      .limit(200);
    return NextResponse.json({ ok: true, orders: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Database offline — the file-backed demo store keeps the preview working.
    const rows = demoListAllOrders().filter((order) => order.categorySlug === ACCOUNT_CATEGORY);
    return NextResponse.json({ ok: true, orders: rows, databaseOffline: true }, { headers: { "Cache-Control": "no-store" } });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAdminScope(request, "orders"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    const id = String(body?.id ?? "").trim();
    const action = String(body?.action ?? "").trim();
    if (!id) return NextResponse.json({ error: "Missing order id." }, { status: 400 });
    if (!["approve_otp", "reject_otp", "generate_otp"].includes(action)) {
      return NextResponse.json({ error: "Unknown OTP action." }, { status: 400 });
    }

    const now = new Date();
    // Both "approve" and "generate" issue a NEW code; "reject" just clears the request.
    const issueCode = action !== "reject_otp";
    const patch = issueCode
      ? {
          otpCode: generateOtpCode(),
          otpIssuedAt: now,
          otpRequestStatus: "approved",
        }
      : { otpRequestStatus: "rejected" };

    try {
      await ensureOrderColumns();
      const [existing] = await db3.select({
        id: orders.id,
        userId: orders.userId,
        orderCode: orders.orderCode,
        productName: orders.productName,
        categorySlug: orders.categorySlug,
        otpRequestStatus: orders.otpRequestStatus,
      }).from(orders).where(eq(orders.id, id)).limit(1);

      if (!existing) return NextResponse.json({ error: "Order not found." }, { status: 404 });
      if (existing.categorySlug !== ACCOUNT_CATEGORY) {
        return NextResponse.json({ error: "This order is not an account purchase." }, { status: 400 });
      }

      await db3.update(orders).set(patch).where(eq(orders.id, id));

      if (existing.userId) {
        await notifyUser({
          userId: existing.userId,
          type: "order_update",
          title: issueCode ? "Your new account OTP is ready" : "OTP request update",
          body: issueCode
            ? `A brand-new 6-digit OTP was generated for ${existing.orderCode}. Open My Orders to view it.`
            : `Your OTP request for ${existing.orderCode} was not approved. You can submit a new request from My Orders.`,
          link: "/account",
          orderId: existing.id,
        }).catch((error) => console.error("OTP notification failed:", error));
      }

      return NextResponse.json({ ok: true, otpCode: issueCode ? patch.otpCode : null, status: patch.otpRequestStatus });
    } catch {
      // Demo store path.
      const target = demoListAllOrders().find((order) => order.id === id || order.orderCode === id);
      if (!target) return NextResponse.json({ error: "Order not found." }, { status: 404 });
      const updated = demoUpdateOrder(target.orderCode, patch);
      if (!updated) return NextResponse.json({ error: "Could not update the order." }, { status: 500 });
      return NextResponse.json({
        ok: true,
        demo: true,
        otpCode: issueCode ? patch.otpCode : null,
        status: patch.otpRequestStatus,
      });
    }
  } catch {
    return NextResponse.json({ error: "Could not process the OTP request." }, { status: 500 });
  }
}
