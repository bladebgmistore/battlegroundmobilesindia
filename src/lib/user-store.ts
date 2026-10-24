import { db1 } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureAuthTables } from "@/lib/auth-tables";
import { SESSION_COOKIE } from "@/lib/auth-config";
import { verifySession } from "@/lib/auth-session";
import { normalizeWhatsapp } from "@/lib/phone";
import type { NextRequest } from "next/server";

/**
 * Google-only customer account store.
 *
 * Identity always comes from the custom Google OAuth signed session cookie; this
 * module resolves that session to the local `users` row used by orders.
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
  if (!session?.email) return null;

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
    const [row] = await db1.select().from(users).where(eq(users.email, session.email)).limit(1);
    if (!row) return fallback;
    if (!row.isActive) return null;
    return {
      id: row.id,
      email: row.email,
      whatsapp: row.whatsapp,
      name: row.name,
      avatarUrl: row.avatarUrl,
      // The signed session role is authoritative (owner allow-list / staff role).
      role: session.role,
      isActive: row.isActive,
      createdAt: row.createdAt,
    };
  } catch {
    return fallback;
  }
}

function normalizePhone(value?: string | null): string | null {
  // Stored as E.164 (`+919876543210`) so the country code survives. A bare
  // 10-digit number is assumed to be Indian (the store's primary market).
  return normalizeWhatsapp(value);
}

/**
 * Users may edit their display name and WhatsApp number (used to contact them
 * about orders). The email is owned by Google and is therefore read-only.
 *
 * Passing `whatsapp: null` (or an empty string) clears the saved number, which
 * is what the Profile & Security "remove" action does.
 */
export async function updateUserProfile(
  id: string,
  input: { name?: string; whatsapp?: string | null },
): Promise<{ user: UserRecord | null; error?: string }> {
  const name = input.name !== undefined ? String(input.name).trim().slice(0, 120) : undefined;
  const whatsapp = input.whatsapp !== undefined
    ? (String(input.whatsapp).trim() ? normalizeWhatsapp(input.whatsapp) : null)
    : undefined;

  if (name !== undefined && !name) return { user: null, error: "Name cannot be empty." };
  if (input.whatsapp && !whatsapp) return { user: null, error: "Enter a valid WhatsApp number with country code." };

  const ready = await ensureAuthTables();
  if (!ready) return { user: null, error: "Database unavailable. Please try again." };

  try {
    const [row] = await db1.update(users)
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
  } catch (error) {
    // `users.whatsapp` is UNIQUE — one number can only belong to one account.
    const message = error instanceof Error ? error.message : "";
    if (/duplicate key|unique constraint/i.test(message)) {
      return { user: null, error: "This WhatsApp number is already linked to another account." };
    }
    return { user: null, error: "Could not update profile." };
  }
}
