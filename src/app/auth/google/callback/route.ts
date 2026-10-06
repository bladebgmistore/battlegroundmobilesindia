import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_STATE_COOKIE } from "@/lib/auth-config";
import { exchangeCodeForTokens, fetchGoogleProfile, getRedirectUri } from "@/lib/google-oauth";
import { createSession } from "@/lib/auth-session";
import { applySessionCookie, isSecureRequest } from "@/lib/auth";
import { upsertGoogleUser } from "@/lib/google-users";
import { recordVisit } from "@/lib/site-logs";
import { getClientIp } from "@/lib/geo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function failure(request: NextRequest, reason: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", reason);
  const response = NextResponse.redirect(url);
  response.cookies.set({ name: OAUTH_STATE_COOKIE, value: "", path: "/", maxAge: 0 });
  return response;
}

/**
 * Step 2 — Google redirects here with `?code=...&state=...`.
 * Verifies state, exchanges the code (PKCE), upserts the user, and issues
 * the signed session cookie.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  if (params.get("error")) return failure(request, "denied");

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return failure(request, "invalid_request");

  // ── CSRF: the state must match the one we issued ──────────────────
  let stored: { state?: string; codeVerifier?: string; next?: string } = {};
  try {
    stored = JSON.parse(request.cookies.get(OAUTH_STATE_COOKIE)?.value ?? "{}");
  } catch {
    return failure(request, "state");
  }
  if (!stored.state || !stored.codeVerifier || stored.state !== state) {
    return failure(request, "state");
  }

  // ── Exchange the authorization code for tokens ────────────────────
  const tokens = await exchangeCodeForTokens({
    code,
    redirectUri: getRedirectUri(request.url),
    codeVerifier: stored.codeVerifier,
  });
  if (tokens.error) {
    console.error("Google token exchange failed:", tokens.error, tokens.error_description);
    return failure(request, "token");
  }

  const profile = await fetchGoogleProfile(tokens);
  if (!profile?.email) return failure(request, "profile");
  if (!profile.emailVerified) return failure(request, "unverified");

  // ── Persist / refresh the local user row ──────────────────────────
  const user = await upsertGoogleUser(profile);
  if (!user.isActive) return failure(request, "disabled");

  const token = await createSession({
    id: user.id,
    googleId: profile.sub,
    email: user.email,
    name: user.name,
    picture: user.avatarUrl,
    role: user.role,
  });

  const target = stored.next && stored.next.startsWith("/") && !stored.next.startsWith("//") ? stored.next : "/dashboard";
  const secure = isSecureRequest(request);
  const response = NextResponse.redirect(new URL(target, request.url));

  applySessionCookie(response, token, secure);
  response.cookies.set({ name: OAUTH_STATE_COOKIE, value: "", path: "/", maxAge: 0 });

  // Log the login event itself (non-blocking telemetry).
  await recordVisit({
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    ipAddress: getClientIp(request),
    pageUrl: "/auth/google/callback (login)",
    userAgent: request.headers.get("user-agent"),
  }).catch(() => undefined);

  return response;
}
