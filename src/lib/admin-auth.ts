import { db } from "@/db";
import { admins, adminSessions } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  ADMIN_COOKIE,
  OWNER_PASSWORD,
  OWNER_ROLE,
  OWNER_USERNAME,
  createSessionToken,
  verifySessionToken,
  type AdminIdentity,
} from "@/lib/admin-session";
import { and, eq, gt } from "drizzle-orm";
import type { NextRequest } from "next/server";

// Re-export edge-safe helpers so existing imports keep working.
export {
  ADMIN_COOKIE,
  createSessionToken,
  verifySessionToken,
  type AdminIdentity,
};

/**
 * Validate the session via cookie. Cookie-token check works everywhere;
 * database session lookup is an extra safety layer when DB is available.
 */
export async function getAdminSession(request: NextRequest): Promise<AdminIdentity | null> {
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  // Signed cookie token is enough (works even when DB is offline).
  const cookieIdentity = verifySessionToken(token);
  if (cookieIdentity) return cookieIdentity;

  // Fallback: stateful DB session (for legacy tokens).
  try {
    const [session] = await db
      .select({ username: adminSessions.username, role: adminSessions.role })
      .from(adminSessions)
      .where(and(eq(adminSessions.sessionToken, token), gt(adminSessions.expiresAt, new Date())))
      .limit(1);
    return session ?? null;
  } catch {
    return null;
  }
}

/**
 * Authenticates an admin against the `admins` table.
 * Bootstrap: `MANAV` / `MANAV7412` always works and self-heals the DB row.
 */
export async function authenticateAdmin(username: string, password: string): Promise<AdminIdentity | null> {
  const cleanUser = String(username ?? "").trim().toUpperCase();
  const cleanPass = String(password ?? "").trim();
  if (!cleanUser || !cleanPass) return null;

  try {
    const [existing] = await db
      .select()
      .from(admins)
      .where(eq(admins.username, cleanUser.toLowerCase()))
      .limit(1);

    if (existing) {
      if (!existing.isActive) return null;
      if (!verifyPassword(cleanPass, existing.passwordHash)) return null;
      return { username: existing.username.toUpperCase(), role: existing.role, email: existing.email };
    }

    if (cleanUser === OWNER_USERNAME && cleanPass === OWNER_PASSWORD) {
      try {
        await db.insert(admins).values({
          username: OWNER_USERNAME.toLowerCase(),
          email: "manav@local.admin",
          passwordHash: hashPassword(OWNER_PASSWORD),
          role: OWNER_ROLE,
          isActive: true,
        });
      } catch {
        // Row may already exist under concurrent load; ignore.
      }
      return { username: OWNER_USERNAME, role: OWNER_ROLE, email: "manav@local.admin" };
    }
  } catch {
    // Database offline — hardcoded owner login still succeeds.
    if (cleanUser === OWNER_USERNAME && cleanPass === OWNER_PASSWORD) {
      return { username: OWNER_USERNAME, role: OWNER_ROLE };
    }
  }

  return null;
}

export async function isOwner(request: NextRequest) {
  const session = await getAdminSession(request);
  return session?.role === OWNER_ROLE ? session : null;
}
