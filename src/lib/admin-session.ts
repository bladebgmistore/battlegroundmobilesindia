/**
 * Edge-safe session token helpers.
 *
 * IMPORTANT: This file MUST NOT import anything from Node.js
 * (no `crypto`, no `fs`, no `pg`, no Drizzle, etc.), because it is imported
 * by the middleware which runs on the Edge Runtime.
 */

export const ADMIN_COOKIE = "bgmi_admin_session";
export const OWNER_USERNAME = "MANAV";
export const OWNER_PASSWORD = "MANAV7412";
export const OWNER_ROLE = "owner";
const TOKEN_SIGNATURE = "bgmi9f3c1a7e42";

export type AdminIdentity = { username: string; role: string; email?: string };

export function createSessionToken(username: string = OWNER_USERNAME, role: string = OWNER_ROLE): string {
  const expires = Date.now() + 1000 * 60 * 60 * 12;
  return `${username.toUpperCase()}.${role}.${expires}.${TOKEN_SIGNATURE}`;
}

export function verifySessionToken(token: string | undefined | null): AdminIdentity | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [user, role, expires, signature] = parts;
  if (signature !== TOKEN_SIGNATURE) return null;
  const expiryTime = Number(expires);
  if (!expiryTime || Number.isNaN(expiryTime) || Date.now() >= expiryTime) return null;
  return { username: user, role };
}
