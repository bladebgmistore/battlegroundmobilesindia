/**
 * Stateless, HMAC-SHA256 signed session tokens for Google-authenticated users.
 *
 * IMPORTANT: Edge-safe. Uses only Web Crypto (`globalThis.crypto.subtle`) and
 * base64url text helpers, so it can be imported from `src/proxy.ts`,
 * route handlers, and server components alike.
 *
 * Token layout:  base64url(JSON payload) + "." + base64url(HMAC-SHA256)
 */

import { getAuthSecret, ROLE_OWNER, SESSION_MAX_AGE_SECONDS } from "@/lib/auth-config";

export type SessionUser = {
  /** Internal users.id (uuid) — may be a Google sub if the DB was offline. */
  id: string;
  /** Google `sub` claim (stable unique account id). */
  googleId: string;
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
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
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

/** Constant-time string compare (avoids signature timing oracles). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Create a signed session token for a freshly authenticated Google user. */
export async function createSession(payload: SessionPayload): Promise<string> {
  const now = Date.now();
  const session: SessionUser = {
    ...payload,
    email: payload.email.toLowerCase(),
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const body = base64UrlEncode(encoder.encode(JSON.stringify(session)));
  const signature = await sign(body);
  return `${body}.${signature}`;
}

/** Verify a token's signature + expiry. Returns null when invalid. */
export async function verifySession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  try {
    const expected = await sign(body);
    if (!safeEqual(expected, signature)) return null;

    const json = new TextDecoder().decode(base64UrlDecode(body));
    const session = JSON.parse(json) as SessionUser;
    if (!session?.email || !session?.exp) return null;
    if (Date.now() >= session.exp) return null;
    return session;
  } catch {
    return null;
  }
}

export function isOwnerSession(session: SessionUser | null): boolean {
  return session?.role === ROLE_OWNER;
}
