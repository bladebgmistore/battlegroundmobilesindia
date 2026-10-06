import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-config";
import { ROLE_OWNER, isAdminAreaRole, roleHasScope, type AdminScope } from "@/lib/rbac";
import { verifySession } from "@/lib/auth-session";
import { effectiveRoleForEmail } from "@/lib/staff";

export type AdminIdentity = { username: string; role: string; email: string };

/**
 * Admin authorisation for the /api/admin/* endpoints.
 *
 * Access is derived from the signed Google session, but the role is
 * re-resolved against OWNER_EMAIL + the staff_members table on every
 * request — so when the owner suspends or removes a team member from the
 * Team & Roles panel, that person loses access immediately instead of
 * whenever their 30-day cookie expires.
 *
 * Roles that can enter the admin area: owner, admin, manager, moderator.
 * Use `requireAdminScope` in route handlers to gate individual endpoints.
 */
export async function getAdminSession(request: NextRequest): Promise<AdminIdentity | null> {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session || !isAdminAreaRole(session.role)) return null;

  const role = await effectiveRoleForEmail(session.email, session.role);
  if (!isAdminAreaRole(role)) return null;

  return { username: session.name, role, email: session.email };
}

/**
 * Scope guard for a specific capability (catalog, orders, site, team…).
 * Returns the caller identity when allowed, otherwise null → 401/403.
 */
export async function requireAdminScope(request: NextRequest, scope: AdminScope): Promise<AdminIdentity | null> {
  const identity = await getAdminSession(request);
  if (!identity) return null;
  return roleHasScope(identity.role, scope) ? identity : null;
}

/** Owner-only check (Team & Roles mutations). */
export async function isOwner(request: NextRequest): Promise<AdminIdentity | null> {
  const identity = await getAdminSession(request);
  if (!identity || identity.role !== ROLE_OWNER) return null;
  return identity;
}
