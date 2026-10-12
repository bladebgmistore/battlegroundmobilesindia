/**
 * Central authentication configuration.
 *
 * Edge-safe: this file only reads process.env and exports constants because it
 * is also imported by `src/proxy.ts`.
 */

/** Name of the signed, HTTP-only session cookie. */
export const SESSION_COOKIE = "bgmi_session";

/** 30-day session lifetime. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Short-lived cookie that stores custom Google OAuth state, PKCE and return path. */
export const OAUTH_STATE_COOKIE = "bgmi_oauth_state";

// Role constants are shared with the client-side dashboard.
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

/** Owner Google accounts — comma-separated email allow-list. */
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

/** HMAC key used to sign application session cookies. */
export function getAuthSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    "bgmi-dev-only-insecure-secret-change-me"
  );
}

/** Pages that can be browsed without signing in. */
export const PUBLIC_PAGES: string[] = [
  "/",
  "/login",
  "/accounts",
  "/uc-purchase",
  "/how-to-buy",
  "/proofs",
  "/contact",
  "/terms",
  "/refund-policy",
  "/rewards",
  "/refer-earn",
];

/** Public APIs required for browse-first storefront and auth. */
export const PUBLIC_API: string[] = [
  "/api/store",
  "/api/feedbacks",
  "/api/proofs",
  "/api/auth/session",
  "/api/auth/me",
  "/api/auth/config-check",
  "/api/track",
  "/api/health",
  "/api/favicon",
  "/api/contact",
  "/api/coupons/validate",
  "/api/bgmi/verify-uid",
];

const PUBLIC_FILES: string[] = ["/robots.txt", "/sitemap.xml", "/favicon.ico", "/404.html"];
export const PUBLIC_PATHS: string[] = [...PUBLIC_PAGES, ...PUBLIC_API, ...PUBLIC_FILES];

export function isPublicPath(pathname: string): boolean {
  const clean = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (PUBLIC_PATHS.includes(clean)) return true;

  // Public product/category browsing.
  if (clean === "/category" || clean.startsWith("/category/")) return true;
  if (clean === "/accounts" || clean.startsWith("/accounts/")) return true;
  if (clean === "/proofs" || clean.startsWith("/proofs/")) return true;

  // Custom Google OAuth round-trip and sign-out endpoint.
  if (clean === "/auth" || clean.startsWith("/auth/")) return true;

  // Next.js internals, static files and image assets.
  if (clean.startsWith("/_next/")) return true;
  if (/\.(?:png|jpe?g|gif|svg|webp|ico|txt|xml|css|js|map|woff2?|ttf)$/i.test(clean)) return true;

  return false;
}
