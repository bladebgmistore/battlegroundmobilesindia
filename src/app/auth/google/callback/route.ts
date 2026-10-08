import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_STATE_COOKIE } from "@/lib/auth-config";
import {
  REFERRAL_COOKIE,
  WELCOME_COOKIE,
  WELCOME_COOKIE_MAX_AGE_SECONDS,
  normalizeReferralCode,
} from "@/lib/referral-config";
import { exchangeCodeForTokens, fetchGoogleProfile, getRedirectUri } from "@/lib/google-oauth";
import { createSession } from "@/lib/auth-session";
import { applySessionCookie, isSecureRequest } from "@/lib/auth";
import { upsertGoogleUser } from "@/lib/google-users";
import { recordVisit } from "@/lib/site-logs";
import { getClientIp } from "@/lib/geo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Redirects use a RELATIVE Location: the browser resolves it against the host it
 * actually used. An absolute URL built from `request.url` would point at the
 * server's bind address (e.g. 0.0.0.0) when Next runs behind a proxy or on a
 * non-public interface, and the session cookie would never be sent there.
 * (`NextResponse.redirect()` only accepts absolute URLs, hence the explicit header.)
 */
function redirectTo(path: string): NextResponse {
  return new NextResponse(null, { status: 307, headers: { Location: path } });
}

function failure(reason: string) {
  const response = redirectTo(`/login?error=${encodeURIComponent(reason)}`);
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

  if (params.get("error")) return failure("denied");

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return failure("invalid_request");

  // ── CSRF: the state must match the one we issued ──────────────────
  let stored: { state?: string; codeVerifier?: string; next?: string } = {};
  try {
    stored = JSON.parse(request.cookies.get(OAUTH_STATE_COOKIE)?.value ?? "{}");
  } catch {
    return failure("state");
  }
  if (!stored.state || !stored.codeVerifier || stored.state !== state) {
    return failure("state");
  }

  // ── Exchange the authorization code for tokens ────────────────────
  const tokens = await exchangeCodeForTokens({
    code,
    redirectUri: getRedirectUri(request.url),
    codeVerifier: stored.codeVerifier,
  });
  if (tokens.error) {
    console.error("Google token exchange failed:", tokens.error, tokens.error_description);
    return failure("token");
  }

  const profile = await fetchGoogleProfile(tokens);
  if (!profile?.email) return failure("profile");
  if (!profile.emailVerified) return failure("unverified");

  // ── Persist / refresh the local user row ──────────────────────────
  // A brand-new account signing up through a referral link is attributed to
  // the referrer (see upsertGoogleUser). Existing accounts are not re-attributed.
  const referralCode = normalizeReferralCode(request.cookies.get(REFERRAL_COOKIE)?.value);
  const user = await upsertGoogleUser(profile, { referralCode });
  if (!user.isActive) return failure("disabled");

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
  const response = redirectTo(target);

  applySessionCookie(response, token, secure);
  response.cookies.set({ name: OAUTH_STATE_COOKIE, value: "", path: "/", maxAge: 0 });
  // The referral link has been consumed by this sign-in.
  response.cookies.set({ name: REFERRAL_COOKIE, value: "", path: "/", maxAge: 0 });
  // One-shot flag so the first page after login can show the "Refer & Win" pop-up.
  response.cookies.set({
    name: WELCOME_COOKIE,
    value: "1",
    httpOnly: false,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: WELCOME_COOKIE_MAX_AGE_SECONDS,
  });

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
