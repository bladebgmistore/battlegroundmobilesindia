import { db } from "@/db";
import { staffMembers } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { isOwnerEmail } from "@/lib/auth-config";
import {
  ROLE_CUSTOMER,
  ROLE_OWNER,
  isStaffRole,
  type StaffRole,
} from "@/lib/rbac";

/**
 * Staff store — the owner-managed team behind /admin.
 *
 * The `staff_members` table maps an email → staff role (admin / manager /
 * moderator). Owners are NOT stored here: the owner role always comes from
 * the OWNER_EMAIL environment variable, so it can never be locked out or
 * edited from the UI.
 *
 * Bootstrap mirrors `ensureAuthTables()`: idempotent, memoised per process,
 * never drops data. Every staff route/helper calls `ensureStaffTables()`
 * first, so a fresh or legacy database is upgraded in place.
 */
type G = typeof globalThis & { __bgmiStaffTablesReady?: Promise<boolean> };

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS staff_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(180) NOT NULL UNIQUE,
    name varchar(120),
    role varchar(20) NOT NULL DEFAULT 'moderator',
    is_active boolean NOT NULL DEFAULT true,
    added_by varchar(180),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS staff_members_email_lower_idx ON staff_members (lower(email))`,
];

export function ensureStaffTables(): Promise<boolean> {
  const g = globalThis as G;
  if (g.__bgmiStaffTablesReady) return g.__bgmiStaffTablesReady;

  g.__bgmiStaffTablesReady = (async () => {
    try {
      for (const statement of STATEMENTS) {
        await db.execute(sql.raw(statement));
      }
      return true;
    } catch {
      // Database offline — retry on the next request.
      g.__bgmiStaffTablesReady = undefined;
      return false;
    }
  })();

  return g.__bgmiStaffTablesReady;
}

export type StaffMember = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  addedBy: string | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
};

const normalizeEmail = (email: string) => String(email ?? "").trim().toLowerCase().slice(0, 180);

/**
 * Decide the login role for a Google account:
 *   1. OWNER_EMAIL allow-list  → owner   (env is the source of truth)
 *   2. active staff_members row → its stored role
 *   3. otherwise               → customer
 */
export async function resolveLoginRole(email: string): Promise<string> {
  if (isOwnerEmail(email)) return ROLE_OWNER;

  try {
    const ready = await ensureStaffTables();
    if (!ready) return ROLE_CUSTOMER;
    const normalized = normalizeEmail(email);
    const [row] = await db
      .select({ role: staffMembers.role, isActive: staffMembers.isActive })
      .from(staffMembers)
      .where(eq(staffMembers.email, normalized))
      .limit(1);
    if (row && row.isActive && isStaffRole(row.role)) return row.role;
  } catch {
    // DB hiccup — safest default is a regular customer session.
  }
  return ROLE_CUSTOMER;
}

/**
 * Re-resolve the role for an already signed-in admin request so revoking a
 * staff member takes effect immediately (not after their 30-day cookie
 * expires). Falls back to the signed session role when the DB is offline,
 * which keeps the owner working during an outage.
 */
export async function effectiveRoleForEmail(email: string, sessionRole: string): Promise<string> {
  if (isOwnerEmail(email)) return ROLE_OWNER; // env always wins, no DB needed
  if (sessionRole === ROLE_OWNER && !isOwnerEmail(email)) {
    // Session claims owner but the env no longer does — demote.
    return ROLE_CUSTOMER;
  }
  try {
    const ready = await ensureStaffTables();
    if (!ready) return sessionRole; // offline: trust the signed cookie
    const normalized = normalizeEmail(email);
    const [row] = await db
      .select({ role: staffMembers.role, isActive: staffMembers.isActive })
      .from(staffMembers)
      .where(eq(staffMembers.email, normalized))
      .limit(1);
    if (row && row.isActive && isStaffRole(row.role)) return row.role;
    return ROLE_CUSTOMER;
  } catch {
    return sessionRole;
  }
}

/** Every staff member, newest first — powers the Team & Roles panel. */
export async function listStaff(): Promise<StaffMember[]> {
  const ready = await ensureStaffTables();
  if (!ready) return [];
  try {
    return await db.select().from(staffMembers).orderBy(desc(staffMembers.createdAt)).limit(200);
  } catch {
    return [];
  }
}

/**
 * Add (or re-activate / re-role) a staff member. Idempotent on email.
 * Owner accounts are rejected — owners already have full access via env.
 */
export async function upsertStaffMember(input: {
  email: string;
  role: string;
  name?: string | null;
  addedBy: string;
}): Promise<{ member?: StaffMember; error?: string }> {
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { error: "Enter a valid email address (the person's Google account)." };
  }
  if (isOwnerEmail(email)) {
    return { error: "This email is already the site owner (OWNER_EMAIL) — full access by default." };
  }
  if (!isStaffRole(input.role)) {
    return { error: "Choose a valid role: admin, manager or moderator." };
  }
  const name = input.name ? String(input.name).trim().slice(0, 120) || null : null;

  const ready = await ensureStaffTables();
  if (!ready) return { error: "Database unavailable. Please try again." };

  try {
    const [row] = await db
      .insert(staffMembers)
      .values({
        email,
        name,
        role: input.role as StaffRole,
        isActive: true,
        addedBy: normalizeEmail(input.addedBy),
      })
      .onConflictDoUpdate({
        target: staffMembers.email,
        set: { role: input.role as StaffRole, name, isActive: true, updatedAt: new Date() },
      })
      .returning();
    return { member: row };
  } catch {
    return { error: "Could not save the team member." };
  }
}

/** Change role / suspend / reactivate / rename a staff member. */
export async function updateStaffMember(
  id: string,
  patch: { role?: string; isActive?: boolean; name?: string | null },
): Promise<{ member?: StaffMember; error?: string }> {
  const ready = await ensureStaffTables();
  if (!ready) return { error: "Database unavailable. Please try again." };
  if (patch.role !== undefined && !isStaffRole(patch.role)) {
    return { error: "Choose a valid role: admin, manager or moderator." };
  }

  try {
    const [existing] = await db.select().from(staffMembers).where(eq(staffMembers.id, id)).limit(1);
    if (!existing) return { error: "Team member not found." };

    const [row] = await db
      .update(staffMembers)
      .set({
        ...(patch.role !== undefined ? { role: patch.role as StaffRole } : {}),
        ...(patch.isActive !== undefined ? { isActive: Boolean(patch.isActive) } : {}),
        ...(patch.name !== undefined ? { name: patch.name ? String(patch.name).trim().slice(0, 120) : null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(staffMembers.id, id))
      .returning();
    return { member: row };
  } catch {
    return { error: "Could not update the team member." };
  }
}

/** Permanently remove a staff member (they instantly lose /admin access). */
export async function deleteStaffMember(id: string): Promise<{ ok: boolean; error?: string }> {
  const ready = await ensureStaffTables();
  if (!ready) return { ok: false, error: "Database unavailable. Please try again." };
  try {
    await db.delete(staffMembers).where(eq(staffMembers.id, id));
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not remove the team member." };
  }
}
