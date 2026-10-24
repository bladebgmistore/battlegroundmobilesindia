import { NextResponse, type NextRequest } from "next/server";
import { db3 } from "@/db";
import { orders } from "@/db/schema";
import { getCurrentUser } from "@/lib/user-store";
import { ensureOrderColumns } from "@/lib/order-columns";
import { demoListOrdersByUser } from "@/lib/demo-orders";
import { and, desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Category handled by the dedicated UC order flow (never shown to the buyer). */
const HIDDEN_CATEGORY = "uc";

/**
 * The signed-in buyer's personal order history.
 *
 * UC top-ups are deliberately EXCLUDED: a UC purchase never appears in "My
 * Orders" — the buyer only sees the success confirmation, while the order is
 * tracked in the Admin Dashboard's UC Orders section (Player ID, character
 * name, transaction reference, amount and status).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await ensureOrderColumns();
    const rows = await db3.select()
      .from(orders)
      .where(
        and(
          eq(orders.userId, user.id),
          // `ne()` would drop rows with a NULL category, so compare coalesced text.
          sql`coalesce(${orders.categorySlug}, '') <> ${HIDDEN_CATEGORY}`,
        ),
      )
      .orderBy(desc(orders.createdAt))
      .limit(200);
    return NextResponse.json({ ok: true, orders: rows });
  } catch {
    // DB offline — expose demo orders for this user so the account dashboard
    // still works in the preview.
    const demoRows = demoListOrdersByUser(user.id)
      .filter((order) => order.categorySlug !== HIDDEN_CATEGORY);
    return NextResponse.json({ ok: true, orders: demoRows, databaseOffline: true });
  }
}
