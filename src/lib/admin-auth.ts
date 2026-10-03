import type { NextRequest } from "next/server";
import { SESSION_COOKIE, ROLE_OWNER } from "@/lib/auth-config";
import { verifySession } from "@/lib/auth-session";

export type AdminIdentity = { username: string; role: string; email: string };

/**
 * Admin authorisation for the existing /api/admin/* endpoints.
 *
 * The password-based admin login has been removed — admin access is now
 * derived purely from the Google session: only an account whose email is in
 * the OWNER_EMAIL allow-list receives the `owner` role.
 */
export async function getAdminSession(request: NextRequest): Promise<AdminIdentity | null> {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session || session.role !== ROLE_OWNER) return null;
  return { username: session.name, role: session.role, email: session.email };
}

/** Alias kept for readability at call sites that need an explicit owner check. */
export async function isOwner(request: NextRequest): Promise<AdminIdentity | null> {
  return getAdminSession(request);
}
