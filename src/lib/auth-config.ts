/**
 * Central auth configuration.
 *
 * Edge-safe: this file must only read `process.env` and export constants —
 * no Node-only imports — because it is pulled in by `src/proxy.ts`.
 */

/** Name of the signed, httpOnly session cookie. */
export const SESSION_COOKIE = "bgmi_session";

/** 30 day rolling session. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Short-lived cookie that carries the OAuth `state` + post-login redirect. */
export const OAUTH_STATE_COOKIE = "bgmi_oauth_state";

// Role constants live in rbac.ts (shared with the client-side dashboard);
// re-exported here so existing server imports keep working.
import {
  ROLE_OWNER,
  ROLE_ADMIN,
  ROLE_MANAGER,
  ROLE_MODERATOR,
  ROLE_CUSTOMER,
  STAFF_ROLES,
  ADMIN_AREA_ROLES,
  isStaffRole,
  isAdminAreaRole,
  roleHasScope,
} from "@/lib/rbac";

export {
  ROLE_OWNER,
  ROLE_ADMIN,
  ROLE_MANAGER,
  ROLE_MODERATOR,
  ROLE_CUSTOMER,
  STAFF_ROLES,
  ADMIN_AREA_ROLES,
  isStaffRole,
  isAdminAreaRole,
  roleHasScope,
};

/**
 * The site owners. Only these Google accounts get the full-access `owner`
 * role (including the Team & Roles manager) — comma separated env var.
 * Everyone else gets their role from the staff_members table (managed by the
 * owner from the admin panel) or falls back to `customer`.
 */
export const OWNER_EMAILS: string[] = (process.env.OWNER_EMAIL ?? "manavjeph800@gmail.com")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return OWNER_EMAILS.includes(email.trim().toLowerCase());
}

export function roleForEmail(email: string | null | undefined): string {
  return isOwnerEmail(email) ? ROLE_OWNER : ROLE_CUSTOMER;
}

/**
 * HMAC key used to sign session cookies.
 * Set AUTH_SECRET in production (`openssl rand -base64 32`).
 */
export function getAuthSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    "bgmi-dev-only-insecure-secret-change-me"
  );
}

/**
 * Pages that can be viewed WITHOUT signing in.
 *
 * Only the homepage is public — the header shows a "Login with Google" button
 * there. Every other page (accounts, UC, checkout, account, dashboard, admin,
 * info pages…) redirects to /login first.
 *
 * To make another page public, just add its path here, e.g. "/terms".
 */
export const PUBLIC_PAGES: string[] = [
  "/", // homepage
  "/login",
  "/proofs", // Customer Proofs — public social proof, no sign-in needed
];

/** API routes the public homepage + login screen need in order to render. */
export const PUBLIC_API: string[] = [
  "/api/store", // catalog shown on the homepage
  "/api/feedbacks", // customer reviews carousel
  "/api/proofs", // verified customer proofs shown on /proofs
  "/api/auth/session", // header: logged in or not?
  "/api/auth/config-check", // deployment diagnostics
  "/api/track", // page-view beacon (also logs guest visits to the homepage)
  "/api/health",
  "/api/favicon",
];

/** Misc. files that must never be gated. */
const PUBLIC_FILES: string[] = ["/robots.txt", "/sitemap.xml", "/favicon.ico", "/404.html"];

export const PUBLIC_PATHS: string[] = [...PUBLIC_PAGES, ...PUBLIC_API, ...PUBLIC_FILES];

export function isPublicPath(pathname: string): boolean {
  // Trailing slashes aside, match the allow-list exactly so that e.g. "/"
  // stays public while "/accounts" does not.
  const clean = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (PUBLIC_PATHS.includes(clean)) return true;

  // The OAuth round-trip itself (/auth/google, /auth/google/callback, /auth/logout).
  if (clean === "/auth" || clean.startsWith("/auth/")) return true;

  // Next.js internals, static files and image assets.
  if (clean.startsWith("/_next/")) return true;
  if (/\.(?:png|jpe?g|gif|svg|webp|ico|txt|xml|css|js|map|woff2?|ttf)$/i.test(clean)) return true;

  return false;
}
