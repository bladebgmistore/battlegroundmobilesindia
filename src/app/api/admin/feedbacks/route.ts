import { db } from "@/db";
import { feedbacks } from "@/db/schema";
import { getAdminSession } from "@/lib/admin-auth";
import { convertGoogleDriveUrl } from "@/lib/image-utils";
import { desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await getAdminSession(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rows = await db.select().from(feedbacks).orderBy(desc(feedbacks.createdAt)).limit(100);
    return Response.json({ feedbacks: rows, databaseOnline: true });
  } catch {
    return Response.json({ feedbacks: [], databaseOnline: false });
  }
}

export async function POST(request: NextRequest) {
  if (!(await getAdminSession(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const review = String(body.review ?? "").trim();
    const rating = Math.max(1, Math.min(5, Number(body.rating ?? 5)));
    const avatar = convertGoogleDriveUrl(String(body.avatar ?? "")) || null;
    if (!name || !review) return Response.json({ error: "Name and review are required." }, { status: 400 });
    const [created] = await db.insert(feedbacks).values({ name, review, rating, avatar, isActive: true }).returning();
    return Response.json({ item: created }, { status: 201 });
  } catch {
    return Response.json({ error: "Could not save feedback." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await getAdminSession(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, ...data } = await request.json();
    if (!id) return Response.json({ error: "Missing id." }, { status: 400 });
    if (data.avatar !== undefined) data.avatar = convertGoogleDriveUrl(String(data.avatar ?? "")) || null;
    const [updated] = await db.update(feedbacks).set({ ...data, updatedAt: new Date() }).where(eq(feedbacks.id, String(id))).returning();
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
