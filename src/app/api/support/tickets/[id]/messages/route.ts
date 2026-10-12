import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/user-store";
import { addMessage, getTicketForUser, listMessages, markTicketReadByUser } from "@/lib/support";

export const dynamic = "force-dynamic";

/**
 * Buyer-side chat on one support ticket.
 *
 * GET  /api/support/tickets/:id/messages → the conversation; opening it marks
 *                                          admin messages as read for the buyer.
 * POST /api/support/tickets/:id/messages → send a message (+ optional file
 *                                          attachment as a Base64 data URL).
 */

// ~2 MB binary ≈ 2.8 MB Base64 — same ceiling as payment screenshots.
const MAX_ATTACHMENT_CHARS = 2_900_000;

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { id } = await params;
  try {
    const ticket = await getTicketForUser(id, user.id);
    if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });

    const messages = await listMessages(ticket.id);
    // The buyer is viewing the chat → admin messages count as read.
    await markTicketReadByUser(ticket.id).catch(() => undefined);
    return NextResponse.json({ ok: true, ticket, messages });
  } catch (error) {
    console.error("Support messages read failed:", error);
    return NextResponse.json({ error: "Could not load messages." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { id } = await params;
  try {
    const ticket = await getTicketForUser(id, user.id);
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

    const created = await addMessage(ticket.id, "user", {
      senderName: user.name,
      message: message || (attachment ? "[Attachment]" : ""),
      attachment,
      attachmentName,
      attachmentType,
    });
    if (!created) {
      // The ticket was resolved & deleted while the buyer was typing.
      return NextResponse.json({ error: "This ticket has been resolved and closed." }, { status: 410 });
    }
    return NextResponse.json({ ok: true, message: created }, { status: 201 });
  } catch (error) {
    console.error("Support message send failed:", error);
    return NextResponse.json({ error: "Could not send the message." }, { status: 500 });
  }
}
