import { db } from "@/db";
import { customerMessages, siteSettings } from "@/db/schema";
import { getAdminSession } from "@/lib/admin-auth";
import { desc, eq } from "drizzle-orm";
import { ensureDbReady } from "@/lib/db-init";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await getAdminSession(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureDbReady();

  try {
    const [messages, settings] = await Promise.all([
      db.select().from(customerMessages).orderBy(desc(customerMessages.createdAt)).limit(100),
      db.select().from(siteSettings),
    ]);
    return Response.json({ messages, settings, databaseOnline: true });
  } catch (error) {
    console.error("Admin management read failed:", error);
    return Response.json(
      { error: "Database connection failed. Check DATABASE_URL on Netlify." },
      { status: 503 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await getAdminSession(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureDbReady();

  try {
    const { key, value, messageId, markRead } = await request.json();

    if (messageId) {
      await db
        .update(customerMessages)
        .set({ isRead: Boolean(markRead) })
        .where(eq(customerMessages.id, String(messageId)));
      return Response.json({ ok: true });
    }

    if (!key) {
      return Response.json({ error: "Missing setting key." }, { status: 400 });
    }

    await db
      .insert(siteSettings)
      .values({ settingKey: String(key), value })
      .onConflictDoUpdate({
        target: siteSettings.settingKey,
        set: { value, updatedAt: new Date() },
      });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Admin management update failed:", error);
    return Response.json({ error: "Could not save setting to the database." }, { status: 500 });
  }
}
