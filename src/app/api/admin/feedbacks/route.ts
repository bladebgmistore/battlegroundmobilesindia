import { db } from "@/db";
import { feedbacks } from "@/db/schema";
import { getAdminSession } from "@/lib/admin-auth";
import { ensureFeedbackTables } from "@/lib/feedback-tables";
import { convertGoogleDriveUrl } from "@/lib/image-utils";
import { desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUSES = new Set(["pending", "approved", "rejected"]);

export async function GET(request: NextRequest) {
  if (!(await getAdminSession(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await ensureFeedbackTables();
  try {
    const rows = await db.select().from(feedbacks).orderBy(desc(feedbacks.createdAt)).limit(200);
    const counts = {
      pending: rows.filter((row) => row.status === "pending").length,
      approved: rows.filter((row) => row.status === "approved").length,
      rejected: rows.filter((row) => row.status === "rejected").length,
    };
    return Response.json({ feedbacks: rows, counts, databaseOnline: true });
  } catch {
    return Response.json({ feedbacks: [], counts: { pending: 0, approved: 0, rejected: 0 }, databaseOnline: false });
  }
}

/** Admin-written review — published straight away. */
export async function POST(request: NextRequest) {
  if (!(await getAdminSession(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await ensureFeedbackTables();
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const review = String(body.review ?? "").trim();
    const rating = Math.max(1, Math.min(5, Number(body.rating ?? 5)));
    const avatar = convertGoogleDriveUrl(String(body.avatar ?? "")) || null;
    if (!name || !review) return Response.json({ error: "Name and review are required." }, { status: 400 });
    const [created] = await db
      .insert(feedbacks)
      .values({ name, review, rating, avatar, isActive: true, status: "approved", moderatedAt: new Date() })
      .returning();
    return Response.json({ item: created }, { status: 201 });
  } catch {
    return Response.json({ error: "Could not save feedback." }, { status: 500 });
  }
}

/**
 * Edit a review or moderate it.
 * Send `{ id, status: "approved" | "rejected" | "pending" }` to accept/deny.
 */
export async function PATCH(request: NextRequest) {
  if (!(await getAdminSession(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await ensureFeedbackTables();
  try {
    const { id, ...data } = await request.json();
    if (!id) return Response.json({ error: "Missing id." }, { status: 400 });
    if (data.avatar !== undefined) data.avatar = convertGoogleDriveUrl(String(data.avatar ?? "")) || null;
    if (data.status !== undefined) {
      const status = String(data.status);
      if (!STATUSES.has(status)) return Response.json({ error: "Invalid status." }, { status: 400 });
      data.status = status;
      data.moderatedAt = new Date();
      // Accepting a review also makes sure it is visible on the site.
      if (status === "approved") data.isActive = true;
    }
    const [updated] = await db
      .update(feedbacks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(feedbacks.id, String(id)))
      .returning();
    return Response.json({ item: updated });
  } catch {
    return Response.json({ error: "Could not update feedback." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await getAdminSession(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await request.json();
    if (!id) return Response.json({ error: "Missing id." }, { status: 400 });
    await db.delete(feedbacks).where(eq(feedbacks.id, String(id)));
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not delete feedback." }, { status: 500 });
  }
}
