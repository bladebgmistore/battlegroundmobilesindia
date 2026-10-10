import { NextResponse, type NextRequest } from "next/server";
import { requireAdminScope } from "@/lib/admin-auth";
import { countOpenTickets, countUnreadForAdmin, listTicketsForAdmin } from "@/lib/support";

export const dynamic = "force-dynamic";

/**
 * Admin side of the order-based Support Ticket system.
 *
 * GET /api/admin/tickets           → every open ticket with unread counts and
 *                                     the latest message preview (support desk).
 * GET /api/admin/tickets?summary=1 → lightweight poll payload for the sidebar
 *                                     badge + live toast/sound alerts.
 */
export async function GET(request: NextRequest) {
  if (!(await requireAdminScope(request, "tickets"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (request.nextUrl.searchParams.get("summary") === "1") {
      const [unreadCount, openCount] = await Promise.all([countUnreadForAdmin(), countOpenTickets()]);
      return NextResponse.json(
        { ok: true, unreadCount, openCount },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const tickets = await listTicketsForAdmin();
    const unreadCount = tickets.reduce((total, ticket) => total + ticket.unreadCount, 0);
    return NextResponse.json(
      { ok: true, tickets, unreadCount, openCount: tickets.length },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Admin tickets read failed:", error);
    return NextResponse.json({ error: "Could not load support tickets." }, { status: 500 });
  }
}
