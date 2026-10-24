import { NextResponse, type NextRequest } from "next/server";
import { db3 } from "@/db";
import { orders } from "@/db/schema";
import { requireAdminScope } from "@/lib/admin-auth";
import { ensureOrderColumns } from "@/lib/order-columns";
import { demoListAllOrders } from "@/lib/demo-orders";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Admin "UC Orders" desk.
 *
 * UC top-ups never appear in the buyer's order history, so the admin gets a
 * dedicated, detailed feed here: buyer identity, BGMI Player ID, in-game
 * character name, the UPI transaction ID / receipt, the amount and the status.
 *
 * Status changes reuse `PATCH /api/orders`; this endpoint only reads.
 */
const UC_CATEGORY = "uc";

export async function GET(request: NextRequest) {
  if (!(await requireAdminScope(request, "orders"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureOrderColumns();
    const rows = await db3.select()
      .from(orders)
      .where(eq(orders.categorySlug, UC_CATEGORY))
      .orderBy(desc(orders.createdAt))
      .limit(200);
    return NextResponse.json({ ok: true, orders: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    const rows = demoListAllOrders().filter((order) => order.categorySlug === UC_CATEGORY);
    return NextResponse.json({ ok: true, orders: rows, databaseOffline: true }, { headers: { "Cache-Control": "no-store" } });
  }
}
