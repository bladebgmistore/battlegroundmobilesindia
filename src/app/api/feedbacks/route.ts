import { db } from "@/db";
import { feedbacks } from "@/db/schema";
import { getSessionFromRequest } from "@/lib/auth";
import { ensureFeedbackTables } from "@/lib/feedback-tables";
import { convertGoogleDriveUrl } from "@/lib/image-utils";
import { and, desc, eq, gte } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Only reviews the admin has ACCEPTED are visible on the website. */
export async function GET() {
  try {
    const rows = await db
      .select()
      .from(feedbacks)
      .where(and(eq(feedbacks.isActive, true), eq(feedbacks.status, "approved")))
      .orderBy(desc(feedbacks.createdAt))
      .limit(12);
    return Response.json({ feedbacks: rows, databaseOnline: true });
  } catch {
    // Legacy database without the `status` column — fall back to is_active.
    try {
      const rows = await db
        .select()
        .from(feedbacks)
        .where(eq(feedbacks.isActive, true))
        .orderBy(desc(feedbacks.createdAt))
        .limit(12);
      return Response.json({ feedbacks: rows, databaseOnline: true });
    } catch {
      return Response.json({ feedbacks: [], databaseOnline: false });
    }
  }
}

/**
 * Player review submission.
 *
 * Requires a Google session (so reviews are accountable) and ALWAYS stores the
 * row as `pending` — it stays invisible on the site until the owner accepts it
 * in Admin → Feedback.
 */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return Response.json(
      { error: "Please sign in with Google to post a review." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    review?: string;
    rating?: number;
  };

  const name = String(body.name ?? session.name ?? "").trim().slice(0, 120);
  const review = String(body.review ?? "").trim().slice(0, 1000);
  const rating = Math.max(1, Math.min(5, Math.round(Number(body.rating ?? 5)) || 5));

  if (!name) return Response.json({ error: "Name is required." }, { status: 400 });
  if (review.length < 10) {
    return Response.json({ error: "Please write at least 10 characters." }, { status: 400 });
  }

  const ready = await ensureFeedbackTables();
  if (!ready) {
    return Response.json({ error: "Database is offline, please try again later." }, { status: 503 });
  }

  try {
    // Light anti-spam: max 3 submissions per user per day.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await db
      .select({ id: feedbacks.id })
      .from(feedbacks)
      .where(and(eq(feedbacks.submittedByEmail, session.email), gte(feedbacks.createdAt, since)))
      .limit(3);
    if (recent.length >= 3) {
      return Response.json(
        { error: "You have already submitted a few reviews today. Please try again tomorrow." },
        { status: 429 },
      );
    }

    const [created] = await db
      .insert(feedbacks)
      .values({
        name,
        review,
        rating,
        avatar: convertGoogleDriveUrl(String(session.picture ?? "")) || null,
        isActive: true,
        status: "pending",
        submittedByEmail: session.email,
      })
      .returning();

    return Response.json(
      {
        ok: true,
        pending: true,
        item: { id: created?.id, name, review, rating },
        message: "Thanks! Your review is awaiting approval from our team.",
      },
      { status: 201 },
    );
  } catch {
    return Response.json({ error: "Could not save your review right now." }, { status: 500 });
  }
}
