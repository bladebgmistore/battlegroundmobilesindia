import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth-config";
import { verifySession, type SessionUser } from "@/lib/auth-session";

export type { SessionUser };

/** Read the session inside a Server Component / Server Action. */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/** Read the session inside a Route Handler. */
export async function getSessionFromRequest(request: NextRequest): Promise<SessionUser | null> {
  return verifySession(request.cookies.get(SESSION_COOKIE)?.value);
}

/** Server Component guard — redirects to the Google login page. */
export async function requireSession(nextPath = "/dashboard"): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return session;
}

/** Server Component guard for the owner-only admin area. */
export async function requireOwner(nextPath = "/admin"): Promise<SessionUser> {
  const session = await requireSession(nextPath);
  if (session.role !== "owner") redirect("/dashboard?error=forbidden");
  return session;
}

/** Route Handler guard — returns a 401/403 response instead of redirecting. */
export async function requireOwnerApi(
  request: NextRequest,
): Promise<{ session: SessionUser; error: null } | { session: null; error: NextResponse }> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return { session: null, error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }
  if (session.role !== "owner") {
    return { session: null, error: NextResponse.json({ error: "Owner access only." }, { status: 403 }) };
  }
  return { session, error: null };
}

export function isSecureRequest(request: NextRequest): boolean {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

/** Attach the signed session cookie to a response. */
export function applySessionCookie(response: NextResponse, token: string, secure: boolean): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set({ name: SESSION_COOKIE, value: "", httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
