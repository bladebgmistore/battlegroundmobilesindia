import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/user-store";
import { countUnreadForUser, listNotificationsForUser, markNotificationsRead } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * User notification center (header bell).
 *
 * GET  /api/notifications          → { notifications, unreadCount }
 * GET  /api/notifications?count=1  → { unreadCount } (lightweight badge poll)
 * POST /api/notifications          → mark read: { ids?[] , all?: boolean, ticketId? }
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const unreadCount = await countUnreadForUser(user.id);
    if (request.nextUrl.searchParams.get("count") === "1") {
      return NextResponse.json({ ok: true, unreadCount }, { headers: { "Cache-Control": "no-store" } });
    }
    const notifications = await listNotificationsForUser(user.id);
    return NextResponse.json(
      { ok: true, notifications, unreadCount },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Notifications read failed:", error);
    return NextResponse.json({ error: "Could not load notifications." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const body = await request.json().catch(() => null);
    const ids = Array.isArray(body?.ids) ? body.ids.map(String).filter(Boolean) : undefined;
    const all = body?.all === true;
    const ticketId = body?.ticketId ? String(body.ticketId) : undefined;

    if (!ids?.length && !all && !ticketId) {
      return NextResponse.json({ error: "Nothing to mark as read." }, { status: 400 });
    }

    await markNotificationsRead(user.id, { ids, all, ticketId });
    const unreadCount = await countUnreadForUser(user.id);
    return NextResponse.json({ ok: true, unreadCount });
  } catch (error) {
    console.error("Notification read failed:", error);
    return NextResponse.json({ error: "Could not update notifications." }, { status: 500 });
  }
}
