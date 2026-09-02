import { db } from "@/db";
import { admins } from "@/db/schema";
import { getAdminSession } from "@/lib/admin-auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const session = await getAdminSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { currentPassword, newPassword } = await request.json();
    if (!currentPassword || !newPassword || String(newPassword).length < 6) {
      return Response.json({ error: "Current password and a new password of 6+ characters are required." }, { status: 400 });
    }

    const [admin] = await db.select().from(admins).where(eq(admins.username, session.username.toLowerCase())).limit(1);
    if (!admin) return Response.json({ error: "Admin account not found." }, { status: 404 });
    
    if (!verifyPassword(String(currentPassword), admin.passwordHash)) {
      return Response.json({ error: "Current password is incorrect." }, { status: 400 });
    }

    await db.update(admins).set({ passwordHash: hashPassword(String(newPassword)), updatedAt: new Date() }).where(eq(admins.id, admin.id));
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Failed to change password:", err);
    return Response.json({ error: "Failed to update password." }, { status: 500 });
  }
}
