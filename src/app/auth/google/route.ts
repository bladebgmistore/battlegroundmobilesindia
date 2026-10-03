import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_STATE_COOKIE } from "@/lib/auth-config";
import {
  buildAuthorizationUrl,
  createCodeChallenge,
  createCodeVerifier,
  createStateValue,
  getRedirectUri,
  isGoogleConfigured,
} from "@/lib/google-oauth";
import { isSecureRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Step 1 of the OAuth dance — "Continue with Google".
 * Creates the CSRF `state` + PKCE verifier, stashes them in a short-lived
 * httpOnly cookie, then sends the browser to Google's consent screen.
 */
export async function GET(request: NextRequest) {
  if (!isGoogleConfigured()) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "config");
    return NextResponse.redirect(url);
  }

  const rawNext = request.nextUrl.searchParams.get("next") ?? "/dashboard";
  // Only allow same-site relative redirects (open-redirect protection).
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  const state = createStateValue();
  const codeVerifier = createCodeVerifier();
  const codeChallenge = await createCodeChallenge(codeVerifier);
  const redirectUri = getRedirectUri(request.url);

  const authorizationUrl = buildAuthorizationUrl({ redirectUri, state, codeChallenge });
  const response = NextResponse.redirect(authorizationUrl);

  response.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: JSON.stringify({ state, codeVerifier, next }),
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
