/**
 * Google OAuth 2.0 (Authorization Code + PKCE) helpers.
 *
 * Pure `fetch` + Web Crypto, so it runs on both the Node and Edge runtimes.
 * Credentials come from env vars — never hardcode them in a client bundle.
 */

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
};

export function getGoogleClientId(): string {
  return process.env.GOOGLE_CLIENT_ID ?? "";
}

export function getGoogleClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET ?? "";
}

export function isGoogleConfigured(): boolean {
  return Boolean(getGoogleClientId() && getGoogleClientSecret());
}

/**
 * The redirect URI must match the one registered in Google Cloud Console.
 * Set GOOGLE_REDIRECT_URI in production; we fall back to the request origin
 * so local dev / preview deploys keep working.
 */
export function getRedirectUri(requestUrl: string): string {
  const configured = process.env.GOOGLE_REDIRECT_URI;
  if (configured) return configured;
  const origin = new URL(requestUrl).origin;
  return `${origin}/auth/google/callback`;
}

function randomUrlSafe(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function createStateValue(): string {
  return randomUrlSafe(24);
}

export function createCodeVerifier(): string {
  return randomUrlSafe(32);
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Build the Google consent-screen URL. */
export function buildAuthorizationUrl(options: {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  loginHint?: string | null;
}): string {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: options.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: options.state,
    code_challenge: options.codeChallenge,
    code_challenge_method: "S256",
    access_type: "online",
    include_granted_scopes: "true",
    prompt: "select_account",
  });
  if (options.loginHint) params.set("login_hint", options.loginHint);
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

type TokenResponse = {
  access_token?: string;
  id_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

/** Exchange the one-time `code` for tokens. */
export async function exchangeCodeForTokens(options: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    cache: "no-store",
    body: new URLSearchParams({
      code: options.code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: options.redirectUri,
      grant_type: "authorization_code",
      code_verifier: options.codeVerifier,
    }).toString(),
  });
  return (await response.json().catch(() => ({}))) as TokenResponse;
}

/** Decode (not verify) a JWT payload — the id_token came straight from Google over TLS. */
function decodeIdToken(idToken: string): Record<string, unknown> | null {
  try {
    const payload = idToken.split(".")[1];
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(decodeURIComponent(escape(atob(padded)))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Resolve the Google profile from the id_token, falling back to the UserInfo endpoint. */
export async function fetchGoogleProfile(tokens: TokenResponse): Promise<GoogleProfile | null> {
  const claims = tokens.id_token ? decodeIdToken(tokens.id_token) : null;

  if (claims?.sub && claims?.email) {
    return {
      sub: String(claims.sub),
      email: String(claims.email).toLowerCase(),
      emailVerified: claims.email_verified !== false,
      name: String(claims.name ?? claims.given_name ?? String(claims.email).split("@")[0]),
      picture: claims.picture ? String(claims.picture) : null,
    };
  }

  if (!tokens.access_token) return null;

  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const info = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!info?.sub || !info?.email) return null;

  return {
    sub: String(info.sub),
    email: String(info.email).toLowerCase(),
    emailVerified: info.email_verified !== false,
    name: String(info.name ?? String(info.email).split("@")[0]),
    picture: info.picture ? String(info.picture) : null,
  };
}
