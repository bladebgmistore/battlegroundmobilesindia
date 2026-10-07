import type { NextRequest } from "next/server";
import { isAdminAreaRole, type AdminScope, ROLE_OWNER, roleHasScope } from "@/lib/rbac";
import { requireAdminApi, requireScopeApi, type ClerkSession } from "@/lib/clerk-auth";

export type AdminIdentity = { username: string; role: string; email: string };

/**
 * Admin authorisation for /api/admin/* endpoints — now powered by Clerk.
 * 
 * Previously used custom signed cookie (bgmi_session). Now uses Clerk's
 * auth() + currentUser() and re-resolves role against OWNER_EMAIL + staff_members
 * table on every request.
 */

export async function getAdminSession(request: NextRequest): Promise<AdminIdentity | null> {
  const result = await requireAdminApi(request);
  if (result.error) return null;
  return {
    username: result.session.name,
    role: result.session.role,
    email: result.session.email,
  };
}

export async function requireAdminScope(request: NextRequest, scope: AdminScope): Promise<AdminIdentity | null> {
  const result = await requireScopeApi(request, scope);
  if (result.error) return null;
  return {
    username: result.session.name,
    role: result.session.role,
    email: result.session.email,
  };
}

export async function isOwner(request: NextRequest): Promise<AdminIdentity | null> {
  const result = await requireAdminApi(request);
  if (result.error) return null;
  if (result.session.role !== ROLE_OWNER) return null;
  return {
    username: result.session.name,
    role: result.session.role,
    email: result.session.email,
  };
}
