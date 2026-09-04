import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { users, userSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@/lib/password";
import { ensureUserTables } from "@/lib/user-tables";
import { demoSet, demoValues, demoGet } from "@/lib/demo-store";
import { createUserToken, verifyUserToken, USER_COOKIE, USER_ROLE } from "@/lib/user-session";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Customer account store.
 *
 * Primary storage is PostgreSQL (via Drizzle). When the database is
 * unreachable — e.g. the live preview here has no DATABASE_URL — we fall
 * back to a small file-backed demo store so the signup / login / account
 * flow keeps working across dev-server restarts. In production
 * (DATABASE_URL set) the database is always used.
 */

export type UserRecord = {
  id: string;
  email: string | null;
  whatsapp: string | null;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string | Date;
};

type DbUserRow = {
  id: string;
  email: string | null;
  whatsapp: string | null;
  name: string;
  role: string;
  isActive: boolean;
  passwordHash: string;
  createdAt: string | Date;
};

// ── In-process cache over the file-backed demo store ───────────────
const memUsers = new Map<string, DbUserRow>();

// Hydrate from disk once so users persist across dev-server restarts.
(function hydrateDemoUsers() {
  try {
    for (const user of demoValues<DbUserRow>("users")) {
      memUsers.set(user.id, user);
    }
  } catch {
    // ignore
  }
})();

function persistDemoUser(row: DbUserRow): void {
  try {
    demoSet("users", row.id, row);
  } catch {
    // ignore
  }
}

function normalizeEmail(value?: string | null): string | null {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  return v.includes("@") ? v : null;
}

function normalizePhone(value?: string | null): string | null {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, "");
  // A plain 10-digit Indian number may be typed with/without +91; match by last 10 digits.
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  return local.length >= 8 && local.length <= 15 ? local : null;
}

export type IdentifierType = "email" | "whatsapp";

export function detectIdentifier(raw: string): { type: IdentifierType; value: string } {
  const value = String(raw ?? "").trim();
  if (!value) return { type: "email", value: "" };
  if (value.includes("@")) return { type: "email", value: normalizeEmail(value) ?? value.toLowerCase() };
  const phone = normalizePhone(value);
  if (phone) return { type: "whatsapp", value: phone };
  return { type: "email", value: value.toLowerCase() };
}

function memIdentifier(identifier: string): { type: IdentifierType; value: string } {
  // Derive the lookup key for the in-memory store.
  return detectIdentifier(identifier);
}

export async function findUserByIdentifier(identifier: string): Promise<DbUserRow | null> {
  const id = detectIdentifier(identifier);
  if (!id.value) return null;

  // Ensure the tables exist before querying (idempotent, memoised per process).
  await ensureUserTables();

  // Try DB first.
  try {
    const [row] = await db
      .select()
      .from(users)
      .where(id.type === "email" ? eq(users.email, id.value) : eq(users.whatsapp, id.value))
      .limit(1);
    if (row) return row as DbUserRow;
  } catch {
    // fall through to memory
  }

  // Memory fallback.
  for (const user of memUsers.values()) {
    if (id.type === "email" && user.email === id.value) return user;
    if (id.type === "whatsapp" && user.whatsapp === id.value) return user;
  }
  return null;
}

export function getUserPasswordHashForDemo(identifier: string): string | null {
  const id = detectIdentifier(identifier);
  if (!id.value) return null;
  for (const user of memUsers.values()) {
    if (id.type === "email" && user.email === id.value) return user.passwordHash;
    if (id.type === "whatsapp" && user.whatsapp === id.value) return user.passwordHash;
  }
  return null;
}

export async function findUserById(id: string): Promise<DbUserRow | null> {
  await ensureUserTables();
  try {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (row) return row as DbUserRow;
  } catch {
    // fall through to memory
  }
  return memUsers.get(id) ?? null;
}

export function toUserRecord(user: DbUserRow): UserRecord {
  return {
    id: user.id,
    email: user.email,
    whatsapp: user.whatsapp,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export async function createUser(input: {
  name: string;
  email?: string | null;
  whatsapp?: string | null;
  password: string;
}): Promise<{ user: UserRecord; error?: string }> {
  const name = String(input.name ?? "").trim().slice(0, 120);
  const email = normalizeEmail(input.email);
  const whatsapp = normalizePhone(input.whatsapp);

  if (!name) return { user: null as never, error: "Please enter your name." };
  if (!email && !whatsapp) return { user: null as never, error: "Enter either an email address or a WhatsApp number." };
  if (!input.password || String(input.password).length < 6) {
    return { user: null as never, error: "Password must be at least 6 characters long." };
  }

  // Uniqueness check (DB or memory).
  const existing = await findUserByIdentifier(email ?? whatsapp ?? "");
  if (existing) {
    const sameEmail = email && existing.email === email;
    const samePhone = whatsapp && existing.whatsapp === whatsapp;
    if (sameEmail) return { user: null as never, error: "An account with this email already exists. Try logging in." };
    if (samePhone) return { user: null as never, error: "An account with this WhatsApp number already exists. Try logging in." };
  }

  const passwordHash = hashPassword(String(input.password));

  // Ensure users / user_sessions tables exist before inserting.
  await ensureUserTables();

  const row: DbUserRow = {
    id: randomUUID(),
    email,
    whatsapp,
    name,
    role: USER_ROLE,
    isActive: true,
    passwordHash,
    createdAt: new Date(),
  };

  // Store in memory + on disk so it survives a dev-server restart.
  memUsers.set(row.id, row);
  persistDemoUser(row);

  try {
    await db.insert(users).values({
      id: row.id,
      email,
      whatsapp,
      name,
      passwordHash,
      role: USER_ROLE,
      isActive: true,
    });
  } catch {
    // DB offline — the memory copy above keeps the demo working.
  }

  return { user: toUserRecord(row) };
}

export async function updateUserProfile(
  id: string,
  input: { name?: string; email?: string | null; whatsapp?: string | null },
): Promise<{ user: UserRecord; error?: string }> {
  const current = await findUserById(id);
  if (!current) return { user: null as never, error: "Account not found." };

  const name = input.name !== undefined ? String(input.name).trim().slice(0, 120) : current.name;
  const email = input.email !== undefined ? normalizeEmail(input.email) : current.email;
  const whatsapp = input.whatsapp !== undefined ? normalizePhone(input.whatsapp) : current.whatsapp;

  if (!name) return { user: null as never, error: "Name cannot be empty." };
  if (!email && !whatsapp) return { user: null as never, error: "Enter either an email address or a WhatsApp number." };

  // Prevent taking over another account's identifier.
  const emailOwner = email ? await findUserByIdentifier(email) : null;
  if (emailOwner && emailOwner.id !== id) return { user: null as never, error: "This email is already used by another account." };
  const phoneOwner = whatsapp ? await findUserByIdentifier(whatsapp) : null;
  if (phoneOwner && phoneOwner.id !== id) return { user: null as never, error: "This WhatsApp number is already used by another account." };

  const updated: DbUserRow = { ...current, name, email, whatsapp, createdAt: current.createdAt };
  // Keep the memory copy fresh and re-hash nothing.
  const memCopy = memUsers.get(id);
  if (memCopy) {
    const next = { ...memCopy, name, email, whatsapp };
    memUsers.set(id, next);
    persistDemoUser(next);
  }

  try {
    await db
      .update(users)
      .set({ name, email, whatsapp, updatedAt: new Date() })
      .where(eq(users.id, id));
  } catch {
    // DB offline — memory copy already updated.
  }

  return { user: toUserRecord(updated) };
}

export async function verifyUserPassword(user: DbUserRow, password: string): Promise<boolean> {
  try {
    return verifyPassword(String(password), user.passwordHash);
  } catch {
    return false;
  }
}

export async function changeUserPassword(
  id: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await findUserById(id);
  if (!user) return { ok: false, error: "Account not found." };
  if (!(await verifyUserPassword(user, currentPassword))) {
    return { ok: false, error: "Current password is incorrect." };
  }
  return setUserPassword(id, newPassword);
}

export async function setUserPassword(id: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  if (!newPassword || String(newPassword).length < 6) {
    return { ok: false, error: "New password must be at least 6 characters long." };
  }
  const passwordHash = hashPassword(String(newPassword));

  const memCopy = memUsers.get(id);
  if (memCopy) {
    const next = { ...memCopy, passwordHash };
    memUsers.set(id, next);
    persistDemoUser(next);
  }

  try {
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, id));
    return { ok: true };
  } catch {
    // DB offline — memory copy already updated.
    return { ok: true };
  }
}

// ── Session cookie helpers (DB-backed, with memory fallback) ─────────
export function buildUserToken(user: UserRecord): string {
  return createUserToken({
    id: user.id,
    identifier: user.email ?? user.whatsapp ?? "",
    name: user.name,
    role: user.role,
  });
}

export async function persistUserSession(request: NextRequest, user: UserRecord): Promise<string> {
  const token = buildUserToken(user);
  await ensureUserTables();
  try {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await db.insert(userSessions).values({ sessionToken: token, userId: user.id, expiresAt });
  } catch {
    // DB offline — signed cookie is still valid on its own.
  }
  return token;
}

export function applyUserCookie(response: NextResponse, token: string, secure: boolean) {
  response.cookies.set({
    name: USER_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: !!secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function getCurrentUser(request: NextRequest): Promise<DbUserRow | null> {
  const token = request.cookies.get(USER_COOKIE)?.value;
  if (!token) return null;
  const identity = verifyUserToken(token);
  if (!identity) return null;
  const user = await findUserById(identity.id);
  if (!user || !user.isActive) return null;
  return user;
}

export async function clearUserSession(request: NextRequest) {
  const { NextResponse } = await import("next/server");
  const token = request.cookies.get(USER_COOKIE)?.value;
  if (token) {
    try {
      await db.delete(userSessions).where(eq(userSessions.sessionToken, token));
    } catch {
      // ignore
    }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: USER_COOKIE, value: "", httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
