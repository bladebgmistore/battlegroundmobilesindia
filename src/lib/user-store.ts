import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureAuthTables } from "@/lib/auth-tables";
import { SESSION_COOKIE } from "@/lib/auth-config";
import { verifySession } from "@/lib/auth-session";
import { normalizeIndianMobile } from "@/lib/phone-number";
import type { NextRequest } from "next/server";

/**
 * Customer account store — Google + Firebase (+91 OTP) edition.
 *
 * Identity always comes from the signed session cookie; this module resolves
 * that session to the local `users` row used by orders.
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
  /** Verified E.164 number for +91 OTP accounts (null for Google accounts). */
  phone?: string | null;
  /** Which method created this session — drives the wording in the UI. */
  provider?: "google" | "phone";
};

export function toUserRecord(user: UserRecord): UserRecord {
  return user;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve the signed-in user (DB row when available) — Google or +91 phone. */
export async function getCurrentUser(request: NextRequest): Promise<UserRecord | null> {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const localPhone = normalizeIndianMobile(session.phone);
  const provider: "google" | "phone" = session.authProvider ?? (session.email ? "google" : "phone");

  const fallback: UserRecord = {
    id: session.id,
    email: session.email || null,
    whatsapp: localPhone,
    name: session.name,
    avatarUrl: session.picture,
    role: session.role,
    isActive: true,
    createdAt: null,
    phone: session.phone ?? null,
    provider,
  };

  const ready = await ensureAuthTables();
  if (!ready) return fallback;

  try {
    // Google accounts (and any account with an email) are matched by email.
    // Phone accounts are matched by their users.id, or — when the session was
    // issued while the DB was offline — by the verified mobile number.
    const lookup = session.email
      ? eq(users.email, session.email)
      : UUID_PATTERN.test(session.id)
        ? eq(users.id, session.id)
        : localPhone
          ? eq(users.whatsapp, localPhone)
          : null;

    if (!lookup) return fallback;

    const [row] = await db.select().from(users).where(lookup).limit(1);
    if (!row) return fallback;
    if (!row.isActive) return null;
    return {
      id: row.id,
      email: row.email,
      whatsapp: row.whatsapp ?? localPhone,
      name: row.name,
      avatarUrl: row.avatarUrl,
      // The session role is authoritative (owner allow-list).
      role: session.role,
      isActive: row.isActive,
      createdAt: row.createdAt,
      phone: session.phone ?? null,
      provider,
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
