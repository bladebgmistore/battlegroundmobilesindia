import { db } from "@/db";
import { admins } from "@/db/schema";
import { getAdminSession, isOwner } from "@/lib/admin-auth";
import { hashPassword } from "@/lib/password";
import { and, desc, eq, ne } from "drizzle-orm";
import { ensureDbReady } from "@/lib/db-init";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const VALID_ROLES = new Set(["owner", "admin", "moderator"]);

function unauthorized() {
  return Response.json({ error: "Owner access required." }, { status: 401 });
}

export async function GET(request: NextRequest) {
  if (!(await isOwner(request))) return unauthorized();
  await ensureDbReady();
  await ensureDbReady();
  try {
    const rows = await db
      .select({
        id: admins.id,
        username: admins.username,
        email: admins.email,
        role: admins.role,
        isActive: admins.isActive,
        createdAt: admins.createdAt,
      })
      .from(admins)
      .orderBy(desc(admins.createdAt));
    return Response.json({ admins: rows });
  } catch (err) {
    console.error("Failed to read admins:", err);
    return Response.json({ admins: [] });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isOwner(request))) return unauthorized();
  try {
    const { username, email, password, role } = await request.json();
    const cleanUser = String(username ?? "").trim().toLowerCase();
    const cleanEmail = String(email ?? "").trim().toLowerCase();
    
    if (!cleanUser || !String(password ?? "")) {
      return Response.json({ error: "Username and password are required." }, { status: 400 });
    }

    const [duplicate] = await db.select({ id: admins.id }).from(admins).where(eq(admins.username, cleanUser)).limit(1);
    if (duplicate) return Response.json({ error: "This username is already taken." }, { status: 409 });

    const [created] = await db.insert(admins).values({
      username: cleanUser,
      email: cleanEmail || `${cleanUser}@local.admin`,
      passwordHash: hashPassword(String(password)),
      role: VALID_ROLES.has(String(role)) ? String(role) : "admin",
      isActive: true,
    }).returning({ id: admins.id, username: admins.username, email: admins.email, role: admins.role, isActive: admins.isActive });

    return Response.json({ admin: created }, { status: 201 });
  } catch (err) {
    console.error("Failed to create admin:", err);
    return Response.json({ error: "Failed to create admin." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const owner = await isOwner(request);
  if (!owner) return unauthorized();
  await ensureDbReady();
  await ensureDbReady();
  try {
    const { id, password, role, isActive, email } = await request.json();
    if (!id) return Response.json({ error: "Missing admin id." }, { status: 400 });

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (password) updates.passwordHash = hashPassword(String(password));
    if (role && VALID_ROLES.has(String(role))) updates.role = String(role);
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (email !== undefined) updates.email = String(email).trim().toLowerCase();

    const [updated] = await db.update(admins).set(updates).where(eq(admins.id, String(id))).returning({
      id: admins.id,
      username: admins.username,
      email: admins.email,
      role: admins.role,
      isActive: admins.isActive,
    });
    return Response.json({ admin: updated });
  } catch (err) {
    console.error("Failed to update admin:", err);
    return Response.json({ error: "Failed to update admin." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const owner = await isOwner(request);
  if (!owner) return unauthorized();
  try {
    const { id } = await request.json();
    if (!id) return Response.json({ error: "Missing admin id." }, { status: 400 });

    const [target] = await db.select().from(admins).where(eq(admins.id, String(id))).limit(1);
    if (target?.username === owner.username.toLowerCase()) {
      return Response.json({ error: "You cannot delete your own account." }, { status: 400 });
    }

    await db.delete(admins).where(and(eq(admins.id, String(id)), ne(admins.username, owner.username.toLowerCase())));
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete admin:", err);
    return Response.json({ error: "Failed to delete admin." }, { status: 500 });
  }
}
