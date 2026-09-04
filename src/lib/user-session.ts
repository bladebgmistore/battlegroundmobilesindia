/**
 * Edge-safe session token helpers for customer accounts.
 *
 * IMPORTANT: This file MUST NOT import anything from Node.js
 * (no `crypto`, no `fs`, no `pg`, no Drizzle, etc.), so it stays
 * compatible with the Edge Runtime and any future middleware.
 */

export const USER_COOKIE = "bgmi_user_session";
export const USER_ROLE = "customer";
const USER_SIGNATURE = "bgmiUser8c4f2a91";
const SESSION_MS = 1000 * 60 * 60 * 24 * 30; // 30-day session

export type UserIdentity = {
  id: string;
  identifier: string;
  name: string;
  role: string;
};

// btoa/atob are available in both Edge and Node (Node 16+).
const toB64 = (value: string): string => {
  try {
    return btoa(unescape(encodeURIComponent(value)));
  } catch {
    return btoa(value);
  }
};

const fromB64 = (value: string): string => {
  try {
    return decodeURIComponent(escape(atob(value)));
  } catch {
    return value;
  }
};

export function createUserToken(identity: Pick<UserIdentity, "id" | "identifier" | "name" | "role">): string {
  const expires = Date.now() + SESSION_MS;
  return [identity.id, identity.role, toB64(identity.identifier), toB64(identity.name), String(expires), USER_SIGNATURE].join(".");
}

export function verifyUserToken(token: string | undefined | null): UserIdentity | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 6) return null;
  const [id, role, identifierB64, nameB64, expires, signature] = parts;
  if (signature !== USER_SIGNATURE) return null;
  const expiryTime = Number(expires);
  if (!expiryTime || Number.isNaN(expiryTime) || Date.now() >= expiryTime) return null;
  return { id, role, identifier: fromB64(identifierB64), name: fromB64(nameB64) };
}
