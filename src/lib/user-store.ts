import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureAuthTables } from "@/lib/auth-tables";
import { getClerkSession } from "@/lib/clerk-auth";

/**
 * Customer account store — now powered by Clerk.
 * 
 * Previously used custom session cookie. Now uses Clerk's currentUser() / auth()
 * to resolve identity, then maps to local users row for orders.
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

/** Resolve the signed-in Clerk user (DB row when available). */
export async function getCurrentUser(_request?: any): Promise<UserRecord | null> {
  const clerk = await getClerkSession();
  if (!clerk) return null;

  const fallback: UserRecord = {
    id: clerk.userId,
    email: clerk.email,
    whatsapp: null,
    name: clerk.name,
    avatarUrl: clerk.picture,
    role: clerk.role,
    isActive: true,
    createdAt: null,
  };

  const ready = await ensureAuthTables();
  if (!ready) return fallback;

  try {
    const [row] = await db.select().from(users).where(eq(users.email, clerk.email)).limit(1);
    if (!row) return fallback;
    if (!row.isActive) return null;
    return {
      id: row.id,
      email: row.email,
      whatsapp: row.whatsapp,
      name: row.name,
      avatarUrl: row.avatarUrl,
      // The session role is authoritative (owner allow-list + staff table)
      role: clerk.role,
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
 * Users may edit their display name and WhatsApp number.
 * Email is owned by Clerk and read-only.
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
