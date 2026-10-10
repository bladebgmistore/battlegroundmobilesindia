import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/user-store";
import {
  createOrGetTicketForOrder,
  getOrderForTicket,
  getOrderSnapshot,
  getTicketByOrderForUser,
  listTicketsForUser,
} from "@/lib/support";

export const dynamic = "force-dynamic";

/**
 * Buyer-side support tickets ("Chat with Admin" on My Orders).
 *
 * GET  /api/support/tickets              → all of my tickets
 * GET  /api/support/tickets?orderId=…    → my ticket for one order (404 if none)
 * POST /api/support/tickets { orderId }  → create (or return) the ticket for an
 *                                           order I own, with an order snapshot
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const orderId = request.nextUrl.searchParams.get("orderId");
    if (orderId) {
      const ticket = await getTicketByOrderForUser(orderId, user.id);
      if (!ticket) return NextResponse.json({ error: "No support ticket for this order yet." }, { status: 404 });
      const order = await getOrderSnapshot(ticket.orderId);
      return NextResponse.json({ ok: true, ticket, order });
    }
    const tickets = await listTicketsForUser(user.id);
    return NextResponse.json({ ok: true, tickets });
  } catch (error) {
    console.error("Support tickets read failed:", error);
    return NextResponse.json({ error: "Could not load support tickets." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const body = await request.json().catch(() => null);
    const orderId = String(body?.orderId ?? "").trim();
    if (!orderId) return NextResponse.json({ error: "Missing orderId." }, { status: 400 });

    // The order must belong to the signed-in buyer.
    const order = await getOrderForTicket(orderId, user.id);
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    const ticket = await createOrGetTicketForOrder(order, { id: user.id, name: user.name, email: user.email });
    if (!ticket) return NextResponse.json({ error: "Could not open a support ticket." }, { status: 500 });

    const snapshot = await getOrderSnapshot(order.id);
    return NextResponse.json({ ok: true, ticket, order: snapshot });
  } catch (error) {
    console.error("Support ticket create failed:", error);
    return NextResponse.json({ error: "Could not open a support ticket." }, { status: 500 });
  }
}
