import { NextResponse, type NextRequest } from "next/server";
import { requireAdminScope } from "@/lib/admin-auth";
import {
  ANNOUNCEMENT_BADGES,
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  type AnnouncementBadge,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * Admin Announcement / Broadcast tool.
 *
 * GET    /api/admin/announcements → broadcast log, newest first.
 * POST   /api/admin/announcements → publish { title, message, badge, target,
 *                                   targetUserId? | targetEmail? }. Instantly
 *                                   appears in the target users' bell inbox.
 * DELETE /api/admin/announcements → { id } removes an announcement and its
 *                                   notification rows.
 */
export async function GET(request: NextRequest) {
  if (!(await requireAdminScope(request, "announcements"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rows = await listAnnouncements();
    return NextResponse.json({ ok: true, announcements: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Announcements read failed:", error);
    return NextResponse.json({ error: "Could not load announcements." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const identity = await requireAdminScope(request, "announcements");
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => null);
    const title = String(body?.title ?? "").trim().slice(0, 180);
    const message = String(body?.message ?? "").trim().slice(0, 4000);
    const badge = String(body?.badge ?? "General") as AnnouncementBadge;
    const target = body?.target === "user" ? "user" : "all";
    const targetUserId = body?.targetUserId ? String(body.targetUserId).trim() : null;
    const targetEmail = body?.targetEmail ? String(body.targetEmail).trim().toLowerCase().slice(0, 180) : null;

    if (!title || !message) {
      return NextResponse.json({ error: "Title and message are required." }, { status: 400 });
    }
    if (!ANNOUNCEMENT_BADGES.includes(badge)) {
      return NextResponse.json({ error: "Invalid announcement type." }, { status: 400 });
    }
    if (target === "user" && !targetUserId && !targetEmail) {
      return NextResponse.json({ error: "Choose the user this announcement targets." }, { status: 400 });
    }

    const created = await createAnnouncement({
      title,
      message,
      badge,
      target,
      targetUserId,
      targetEmail,
      createdBy: identity.email,
    });
    if (!created) return NextResponse.json({ error: "Could not publish the announcement." }, { status: 500 });

    return NextResponse.json({ ok: true, announcement: created }, { status: 201 });
  } catch (error) {
    console.error("Announcement create failed:", error);
    return NextResponse.json({ error: "Could not publish the announcement." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdminScope(request, "announcements"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => null);
    const id = String(body?.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "Missing announcement id." }, { status: 400 });
    const removed = await deleteAnnouncement(id);
    if (!removed) return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Announcement delete failed:", error);
    return NextResponse.json({ error: "Could not delete the announcement." }, { status: 500 });
  }
}
