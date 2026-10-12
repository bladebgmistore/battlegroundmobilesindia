/**
 * Stateless, HMAC-SHA256 signed sessions for users authenticated by the custom Google OAuth flow.
 *
 * Edge-safe: uses only Web Crypto (`globalThis.crypto.subtle`) and base64url
 * helpers, so it can be imported from the proxy, route handlers and server
 * components alike.
 *
 * Token layout: base64url(JSON payload) + "." + base64url(HMAC-SHA256)
 */
import { getAuthSecret, ROLE_OWNER, SESSION_MAX_AGE_SECONDS } from "@/lib/auth-config";

export type SessionUser = {
  /** Internal users.id (UUID) — falls back to the verified Google id if DB is offline. */
  id: string;
  /** Stable Google `sub` claim returned by Google's userinfo endpoint. */
  googleId: string;
  /** Verified Google email. */
  email: string;
  name: string;
  picture: string | null;
  role: string;
  /** Issued-at (ms epoch). */
  iat: number;
  /** Expiry (ms epoch). */
  exp: number;
};

export type SessionPayload = Omit<SessionUser, "iat" | "exp">;

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(data: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await getKey(), encoder.encode(data));
  return base64UrlEncode(new Uint8Array(signature));
}

/** Constant-time string comparison (avoids signature timing oracles). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

/** Create a signed session token for a Google OAuth-authenticated user. */
export async function createSession(payload: SessionPayload): Promise<string> {
  const email = payload.email.trim().toLowerCase();
  if (!email) throw new Error("Google sign-in requires a verified email address.");

  const now = Date.now();
  const session: SessionUser = {
    ...payload,
    email,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const body = base64UrlEncode(encoder.encode(JSON.stringify(session)));
  const signature = await sign(body);
  return `${body}.${signature}`;
}

/** Verify a session signature and expiry. Returns null when invalid. */
export async function verifySession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  try {
    const expected = await sign(body);
    if (!safeEqual(expected, signature)) return null;

    const session = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as SessionUser;
    if (!session?.id || !session?.googleId || !session?.email?.trim() || !session?.exp) return null;
    if (Date.now() >= session.exp) return null;
    return session;
  } catch {
    return null;
  }
}

export function isOwnerSession(session: SessionUser | null): boolean {
  return session?.role === ROLE_OWNER;
}
