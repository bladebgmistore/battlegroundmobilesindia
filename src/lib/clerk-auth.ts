/**
 * Clerk-based authentication helpers — replaces old custom Google OAuth session.
 * 
 * Owner/Admin email: manavjeph800@gmail.com gets full access to /admin.
 * Additional staff roles are resolved from staff_members table (same as before).
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { isOwnerEmail as isOwnerEmailConfig } from "@/lib/auth-config";
import { effectiveRoleForEmail, resolveLoginRole } from "@/lib/staff";
import { isAdminAreaRole, ROLE_OWNER, type AdminScope, roleHasScope } from "@/lib/rbac";

export const OWNER_EMAIL = "manavjeph800@gmail.com";

/**
 * Check if email is owner — includes both hardcoded owner and env allow-list.
 */
export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (normalized === OWNER_EMAIL.toLowerCase()) return true;
  return isOwnerEmailConfig(email);
}

export type ClerkSession = {
  userId: string;
  email: string;
  name: string;
  picture: string | null;
  role: string;
  clerkUser: Awaited<ReturnType<typeof currentUser>>;
};

/**
 * Get current Clerk user with resolved role.
 * Returns null if not authenticated.
 */
export async function getClerkSession(): Promise<ClerkSession | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  if (!user) return null;

  const primaryEmail = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId
  )?.emailAddress || user.emailAddresses[0]?.emailAddress || null;

  if (!primaryEmail) return null;

  const email = primaryEmail.toLowerCase();
  const role = await resolveLoginRole(email);

  const name =
    user.fullName ||
    `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
    email.split("@")[0];

  const picture = user.imageUrl ?? null;

  return {
    userId,
    email,
    name,
    picture,
    role,
    clerkUser: user,
  };
}

/**
 * Server Component guard — redirects to sign-in if not authenticated.
 * Use in pages like /dashboard, /admin, etc.
 */
export async function requireClerkSession(): Promise<ClerkSession> {
  const session = await getClerkSession();
  if (!session) {
    const { redirect } = await import("next/navigation");
    redirect("/sign-in");
    // redirect throws, but TS needs explicit never
    throw new Error("Redirecting to sign-in");
  }
  return session as ClerkSession;
}

/**
 * Server Component guard for admin area (/admin).
 * Allows owner + staff roles (admin/manager/moderator).
 */
export async function requireAdminArea(): Promise<ClerkSession> {
  const session = await requireClerkSession();
  
  // Fast check: is session role already admin area?
  if (!isAdminAreaRole(session.role)) {
    const { redirect } = await import("next/navigation");
    redirect("/dashboard?error=forbidden");
  }

  // Re-resolve role from DB for instant revoke
  const effectiveRole = await effectiveRoleForEmail(session.email, session.role);
  if (!isAdminAreaRole(effectiveRole)) {
    const { redirect } = await import("next/navigation");
    redirect("/dashboard?error=forbidden");
  }

  return { ...session, role: effectiveRole };
}

/**
 * Owner-only guard.
 */
export async function requireOwner(): Promise<ClerkSession> {
  const session = await requireAdminArea();
  if (session.role !== ROLE_OWNER) {
    const { redirect } = await import("next/navigation");
    redirect("/dashboard?error=forbidden");
  }
  return session;
}

/**
 * API Route guard — returns 401/403 responses instead of redirects.
 */
export async function requireAdminApi(request: NextRequest): Promise<{ session: ClerkSession; error: null } | { session: null; error: NextResponse }> {
  const { userId } = await auth();
  if (!userId) {
    return {
      session: null,
      error: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  const user = await currentUser();
  if (!user) {
    return {
      session: null,
      error: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  const primaryEmail = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress || user.emailAddresses[0]?.emailAddress;
  if (!primaryEmail) {
    return {
      session: null,
      error: NextResponse.json({ error: "No email found." }, { status: 401 }),
    };
  }

  const email = primaryEmail.toLowerCase();
  const baseRole = await resolveLoginRole(email);
  const role = await effectiveRoleForEmail(email, baseRole);

  if (!isAdminAreaRole(role)) {
    return {
      session: null,
      error: NextResponse.json({ error: "Admin access only." }, { status: 403 }),
    };
  }

  const name = user.fullName || `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || email.split("@")[0];

  return {
    session: {
      userId,
      email,
      name,
      picture: user.imageUrl ?? null,
      role,
      clerkUser: user,
    },
    error: null,
  };
}

/**
 * Scope-based API guard.
 */
export async function requireScopeApi(request: NextRequest, scope: AdminScope): Promise<{ session: ClerkSession; error: null } | { session: null; error: NextResponse }> {
  const result = await requireAdminApi(request);
  if (result.error) return result;

  if (!roleHasScope(result.session.role, scope)) {
    return {
      session: null,
      error: NextResponse.json({ error: `Your role does not allow the "${scope}" area.` }, { status: 403 }),
    };
  }

  return result;
}

/**
 * Helper for /api/auth/session — returns Clerk user in old format for backward compatibility.
 */
export async function getSessionForApi() {
  const session = await getClerkSession();
  if (!session) return null;

  return {
    id: session.userId,
    email: session.email,
    name: session.name,
    picture: session.picture,
    role: session.role,
    isOwner: session.role === ROLE_OWNER,
    adminAccess: isAdminAreaRole(session.role),
  };
}
