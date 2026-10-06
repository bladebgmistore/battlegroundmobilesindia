import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureAuthTables } from "@/lib/auth-tables";
import { SESSION_COOKIE } from "@/lib/auth-config";
import { verifySession } from "@/lib/auth-session";
import type { NextRequest } from "next/server";

/**
 * Customer account store — Google-only edition.
 *
 * The password login (register / login / reset) has been removed. Identity
 * always comes from the signed Google session cookie; this module just
 * resolves that session to the local `users` row used by orders.
 */

export type UserRecord = {
  id: string;
  email: string | null;
  whatsapp: string | null;
  name: string;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
  createdAt: string | Date | null;
};

export function toUserRecord(user: UserRecord): UserRecord {
  return user;
}

/** Resolve the signed-in Google user (DB row when available). */
export async function getCurrentUser(request: NextRequest): Promise<UserRecord | null> {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const fallback: UserRecord = {
    id: session.id,
    email: session.email,
    whatsapp: null,
    name: session.name,
    avatarUrl: session.picture,
    role: session.role,
    isActive: true,
    createdAt: null,
  };

  const ready = await ensureAuthTables();
  if (!ready) return fallback;

  try {
    const [row] = await db.select().from(users).where(eq(users.email, session.email)).limit(1);
    if (!row) return fallback;
    if (!row.isActive) return null;
    return {
      id: row.id,
      email: row.email,
      whatsapp: row.whatsapp,
      name: row.name,
      avatarUrl: row.avatarUrl,
      // The session role is authoritative (owner allow-list).
      role: session.role,
      isActive: row.isActive,
      createdAt: row.createdAt,
    };
  } catch {
    return fallback;
  }
}

function normalizePhone(value?: string | null): string | null {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, "");
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  return local.length >= 8 && local.length <= 15 ? local : null;
}

/**
 * Users may edit their display name and WhatsApp number (used to contact them
 * about orders). The email is owned by Google and is therefore read-only.
 */
export async function updateUserProfile(
  id: string,
  input: { name?: string; whatsapp?: string | null },
): Promise<{ user: UserRecord | null; error?: string }> {
  const name = input.name !== undefined ? String(input.name).trim().slice(0, 120) : undefined;
  const whatsapp = input.whatsapp !== undefined ? normalizePhone(input.whatsapp) : undefined;

  if (name !== undefined && !name) return { user: null, error: "Name cannot be empty." };
  if (input.whatsapp && !whatsapp) return { user: null, error: "Enter a valid WhatsApp number." };

  const ready = await ensureAuthTables();
  if (!ready) return { user: null, error: "Database unavailable. Please try again." };

  try {
    const [row] = await db
      .update(users)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(whatsapp !== undefined ? { whatsapp } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    if (!row) return { user: null, error: "Account not found." };

    return {
      user: {
        id: row.id,
        email: row.email,
        whatsapp: row.whatsapp,
        name: row.name,
        avatarUrl: row.avatarUrl,
        role: row.role,
        isActive: row.isActive,
        createdAt: row.createdAt,
      },
    };
  } catch {
    return { user: null, error: "Could not update profile." };
  }
}
