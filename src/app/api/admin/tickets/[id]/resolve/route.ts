import { NextResponse, type NextRequest } from "next/server";
import { requireAdminScope } from "@/lib/admin-auth";
import { resolveTicket } from "@/lib/support";

export const dynamic = "force-dynamic";

/**
 * "Close & Resolve Ticket" — marks the issue resolved and PERMANENTLY deletes
 * the ticket and its entire chat history, so it disappears from both the
 * customer's and the admin's dashboards.
 *
 * POST /api/admin/tickets/:id/resolve
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminScope(request, "tickets"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const resolved = await resolveTicket(id);
    if (!resolved) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    return NextResponse.json({ ok: true, resolved: true });
  } catch (error) {
    console.error("Ticket resolve failed:", error);
    return NextResponse.json({ error: "Could not resolve the ticket." }, { status: 500 });
  }
}
