import { NextResponse, type NextRequest } from "next/server";
import { requireAdminScope } from "@/lib/admin-auth";
import { addMessage, getTicketForAdmin, listMessages, markTicketReadByAdmin } from "@/lib/support";

export const dynamic = "force-dynamic";

/**
 * Admin-side chat on one support ticket.
 *
 * GET  /api/admin/tickets/:id/messages → the conversation; opening it marks
 *                                        customer messages as read (badge).
 * POST /api/admin/tickets/:id/messages → admin reply (+ optional attachment);
 *                                        notifies the buyer's bell instantly.
 */

const MAX_ATTACHMENT_CHARS = 2_900_000;

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!(await requireAdminScope(request, "tickets"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const ticket = await getTicketForAdmin(id);
    if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });

    const messages = await listMessages(ticket.id);
    // Staff opened the ticket → customer messages count as read.
    await markTicketReadByAdmin(ticket.id).catch(() => undefined);
    return NextResponse.json({ ok: true, ticket, messages });
  } catch (error) {
    console.error("Admin ticket messages read failed:", error);
    return NextResponse.json({ error: "Could not load messages." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const identity = await requireAdminScope(request, "tickets");
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const ticket = await getTicketForAdmin(id);
    if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });

    const body = await request.json().catch(() => null);
    const message = String(body?.message ?? "").trim().slice(0, 4000);
    const attachment = typeof body?.attachment === "string" ? body.attachment : null;
    const attachmentName = String(body?.attachmentName ?? "").trim().slice(0, 255) || null;
    const attachmentType = String(body?.attachmentType ?? "").trim().slice(0, 64) || null;

    if (attachment && (!attachment.startsWith("data:") || attachment.length > MAX_ATTACHMENT_CHARS)) {
      return NextResponse.json({ error: "Attachment is too large or invalid." }, { status: 400 });
    }
    if (!message && !attachment) {
      return NextResponse.json({ error: "Write a message or attach a file." }, { status: 400 });
    }

    const created = await addMessage(ticket.id, "admin", {
      senderName: identity.username,
      message: message || (attachment ? "[Attachment]" : ""),
      attachment,
      attachmentName,
      attachmentType,
    });
    if (!created) {
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, message: created }, { status: 201 });
  } catch (error) {
    console.error("Admin ticket reply failed:", error);
    return NextResponse.json({ error: "Could not send the reply." }, { status: 500 });
  }
}
