import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { getCurrentUser } from "@/lib/user-store";
import { ensureOrderColumns } from "@/lib/order-columns";
import { demoListOrdersByUser } from "@/lib/demo-orders";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await ensureOrderColumns();
    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, user.id))
      .orderBy(desc(orders.createdAt))
      .limit(200);
    return NextResponse.json({ ok: true, orders: rows });
  } catch {
    // DB offline — expose demo orders for this user so the account dashboard
    // still works in the preview.
    return NextResponse.json({ ok: true, orders: demoListOrdersByUser(user.id), databaseOffline: true });
  }
}
