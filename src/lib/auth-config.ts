/**
 * Central auth configuration.
 *
 * Edge-safe: this file must only read `process.env` and export constants —
 * no Node-only imports — because it is pulled in by `src/middleware.ts`.
 */

/** Name of the signed, httpOnly session cookie. */
export const SESSION_COOKIE = "bgmi_session";

/** 30 day rolling session. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Short-lived cookie that carries the OAuth `state` + post-login redirect. */
export const OAUTH_STATE_COOKIE = "bgmi_oauth_state";

export const ROLE_OWNER = "owner";
export const ROLE_CUSTOMER = "customer";

/**
 * The single site owner. Only this Google account can open /admin.
 * Override in production with OWNER_EMAIL (comma separated for extra admins).
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

/** Paths that must stay reachable without a session. */
export const PUBLIC_PATHS: string[] = [
  "/login",
  "/auth/google",
  "/auth/google/callback",
  "/auth/logout",
  "/api/auth/google",
  "/api/auth/session",
  "/api/auth/config-check",
  "/api/auth/logout",
  "/api/health",
  "/api/favicon",
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
  "/404.html",
];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  // Next.js internals, static files and image assets.
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/auth/")) return true;
  if (/\.(?:png|jpe?g|gif|svg|webp|ico|txt|xml|css|js|map|woff2?|ttf)$/i.test(pathname)) return true;
  return false;
}
