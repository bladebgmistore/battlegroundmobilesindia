import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isAdminAreaRole, isPublicPath } from "@/lib/auth-config";
import { verifySession } from "@/lib/auth-session";
import { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE_SECONDS, normalizeReferralCode } from "@/lib/referral-config";

/**
 * Compulsory Google authentication (Next.js 16 `proxy` file convention —
 * the former `middleware.ts`, renamed per
 * https://nextjs.org/docs/messages/middleware-to-proxy).
 *
 * Runs on the Edge runtime for every request that isn't a static asset.
 * - No session  →  /login?next=<original path>   (JSON 401 for /api/*)
 * - Session     →  request continues, with the resolved identity forwarded
 *                  to server components via `x-pathname` / `x-user-email`.
 */
export async function proxy(request: NextRequest) {
  const response = await gate(request);
  captureReferralLink(request, response);
  return response;
}

/**
 * Refer & Earn: remember the referrer from a `?ref=CODE` link so the Google
 * sign-up that follows can be attributed to them (read by the OAuth callback).
 * The latest link opened before signing up wins.
 */
function captureReferralLink(request: NextRequest, response: NextResponse) {
  if (request.method !== "GET") return;
  const { pathname, searchParams, protocol } = request.nextUrl;
  if (pathname.startsWith("/api/")) return;

  const code = normalizeReferralCode(searchParams.get("ref"));
  if (!code || request.cookies.get(REFERRAL_COOKIE)?.value === code) return;

  response.cookies.set({
    name: REFERRAL_COOKIE,
    value: code,
    httpOnly: true,
    sameSite: "lax",
    secure: protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
    path: "/",
    maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
  });
}

async function gate(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  const forwardHeaders = () => {
    const headers = new Headers(request.headers);
    headers.set("x-pathname", pathname);
    return headers;
  };

  if (isPublicPath(pathname)) {
    return NextResponse.next({ request: { headers: forwardHeaders() } });
  }

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required.", login: "/login" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    const response = NextResponse.redirect(loginUrl);
    // Drop an expired/tampered cookie so the login page starts clean.
    if (request.cookies.has(SESSION_COOKIE)) {
      response.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
    }
    return response;
  }

  // Staff-only area (owner / admin / manager / moderator). The page guard
  // and API routes re-verify the role against the database — this edge check
  // is just the fast first gate on the signed cookie.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!isAdminAreaRole(session.role)) {
      return NextResponse.redirect(new URL("/dashboard?error=forbidden", request.url));
    }
  }

  const headers = forwardHeaders();
  headers.set("x-user-email", session.email);
  headers.set("x-user-role", session.role);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  /**
   * Everything except Next internals and public files.
   * (`isPublicPath` does the fine-grained allow-listing.)
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml|css|js|woff2?|ttf)$).*)"],
};
