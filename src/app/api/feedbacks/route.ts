import { db } from "@/db";
import { feedbacks } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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
