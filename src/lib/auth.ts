/**
 * Auth compatibility layer — now powered by Clerk.
 * 
 * Old code used custom HMAC session cookies (bgmi_session). All guards now
 * delegate to @/lib/clerk-auth.ts which uses Clerk's currentUser() / auth().
 * 
 * This file keeps the same exported function names so existing imports
 * (requireSession, requireAdminArea, etc.) keep working after the Clerk migration.
 */

import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAdminAreaRole, ROLE_OWNER, roleHasScope, type AdminScope } from "@/lib/rbac";
import {
  getClerkSession,
  requireClerkSession as requireClerkSessionBase,
  requireAdminArea as requireAdminAreaBase,
  requireOwner as requireOwnerBase,
  requireAdminApi,
  requireScopeApi as requireScopeApiBase,
  type ClerkSession,
} from "@/lib/clerk-auth";

export type SessionUser = {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture: string | null;
  role: string;
  iat: number;
  exp: number;
};

function toLegacySession(clerk: ClerkSession): SessionUser {
  return {
    id: clerk.userId,
    googleId: clerk.userId,
    email: clerk.email,
    name: clerk.name,
    picture: clerk.picture,
    role: clerk.role,
    iat: Date.now(),
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
}

/** Read the session inside a Server Component / Server Action. */
export async function getSession(): Promise<SessionUser | null> {
  const clerk = await getClerkSession();
  if (!clerk) return null;
  return toLegacySession(clerk);
}

/** Read the session inside a Route Handler. */
export async function getSessionFromRequest(_request: NextRequest): Promise<SessionUser | null> {
  const clerk = await getClerkSession();
  if (!clerk) return null;
  return toLegacySession(clerk);
}

/** Server Component guard — redirects to Clerk sign-in. */
export async function requireSession(nextPath = "/dashboard"): Promise<SessionUser> {
  const clerk = await getClerkSession();
  if (!clerk) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(nextPath)}`);
  }
  return toLegacySession(clerk);
}

/** Server Component guard for the staff admin area (/admin). */
export async function requireAdminArea(nextPath = "/admin"): Promise<SessionUser> {
  const clerk = await requireAdminAreaBase();
  return toLegacySession(clerk);
}

/** Server Component guard for owner-only pages. */
export async function requireOwner(nextPath = "/admin"): Promise<SessionUser> {
  const clerk = await requireOwnerBase();
  return toLegacySession(clerk);
}

/** Route Handler guard — returns a 401/403 response instead of redirecting. */
export async function requireOwnerApi(
  request: NextRequest,
): Promise<{ session: SessionUser; error: null } | { session: null; error: NextResponse }> {
  const result = await requireAdminApi(request);
  if (result.error) return { session: null, error: result.error };
  if (result.session.role !== ROLE_OWNER) {
    return { session: null, error: NextResponse.json({ error: "Owner access only." }, { status: 403 }) };
  }
  return { session: toLegacySession(result.session), error: null };
}

/** Scope-based Route Handler guard. */
export async function requireScopeApi(
  request: NextRequest,
  scope: AdminScope,
): Promise<{ session: SessionUser; error: null } | { session: null; error: NextResponse }> {
  const result = await requireScopeApiBase(request, scope);
  if (result.error) return { session: null, error: result.error };
  return { session: toLegacySession(result.session), error: null };
}

export function isSecureRequest(request: NextRequest): boolean {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

/** No-op now — Clerk manages cookies. Kept for compatibility. */
export function applySessionCookie(response: NextResponse, _token: string, _secure: boolean): NextResponse {
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  return response;
}
