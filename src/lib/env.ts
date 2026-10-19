/**
 * Single source of truth for every environment variable this project reads.
 *
 * This project uses THREE separate Neon PostgreSQL databases:
 *
 *   DB1 (DATABASE_URL_DB1) — User Accounts, Authentication, Profiles, Roles
 *   DB2 (DATABASE_URL_DB2) — Store Inventory, Products, Categories, Pricing
 *   DB3 (DATABASE_URL_DB3) — Orders, Transactions, Proofs, Referral Points
 *
 * Every variable is documented in `.env.example`. There is intentionally no
 * single `DATABASE_URL` fallback: a missing key fails loudly for that database
 * instead of silently pointing all three clients at one database.
 */

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** First non-empty value among `keys` (whitespace-only counts as empty). */
function firstEnv(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/*  1. Database — 3 separate Neon PostgreSQL databases                        */
/* -------------------------------------------------------------------------- */

const DB1_URL_KEYS = ["DATABASE_URL_DB1"] as const;
const DB2_URL_KEYS = ["DATABASE_URL_DB2"] as const;
const DB3_URL_KEYS = ["DATABASE_URL_DB3"] as const;

/** Shown whenever a database is required but its key is missing. */
export const DATABASE_CONFIG_HINT =
  "Database is not configured. Set DATABASE_URL_DB1, DATABASE_URL_DB2 and DATABASE_URL_DB3 in your environment (see .env.example).";

/** DB1 — users, authentication, profiles, roles. */
export function getDatabaseUrlDb1(): string | undefined {
  return firstEnv(DB1_URL_KEYS);
}

/** DB2 — store inventory, products, categories, items, pricing. */
export function getDatabaseUrlDb2(): string | undefined {
  return firstEnv(DB2_URL_KEYS);
}

/** DB3 — orders, transactions, payment logs, proofs, referral points. */
export function getDatabaseUrlDb3(): string | undefined {
  return firstEnv(DB3_URL_KEYS);
}

export function requireDatabaseUrlDb1(): string {
  const url = getDatabaseUrlDb1();
  if (!url) throw new Error(`${DATABASE_CONFIG_HINT} Missing DATABASE_URL_DB1.`);
  return url;
}

export function requireDatabaseUrlDb2(): string {
  const url = getDatabaseUrlDb2();
  if (!url) throw new Error(`${DATABASE_CONFIG_HINT} Missing DATABASE_URL_DB2.`);
  return url;
}

export function requireDatabaseUrlDb3(): string {
  const url = getDatabaseUrlDb3();
  if (!url) throw new Error(`${DATABASE_CONFIG_HINT} Missing DATABASE_URL_DB3.`);
  return url;
}

/** `true` only when all three databases are configured. */
export function isDatabaseConfigured(): boolean {
  return Boolean(getDatabaseUrlDb1() && getDatabaseUrlDb2() && getDatabaseUrlDb3());
}

export function isDatabaseDb1Configured(): boolean {
  return Boolean(getDatabaseUrlDb1());
}

export function isDatabaseDb2Configured(): boolean {
  return Boolean(getDatabaseUrlDb2());
}

export function isDatabaseDb3Configured(): boolean {
  return Boolean(getDatabaseUrlDb3());
}

/** Neon project id — diagnostics only. */
export function getNeonProjectId(): string | undefined {
  return firstEnv(["BGMISTORE_NEON_PROJECT_ID"]);
}

/* -------------------------------------------------------------------------- */
/*  Value validation                                                           */
/* -------------------------------------------------------------------------- */

/**
 * `true` when `value` is a plain absolute `http(s)` URL.
 *
 * Deliberately strict: a value pasted out of rendered Markdown — which is how
 * `[https://example.com](https://example.com)` ends up in a dashboard field —
 * fails here, as does anything with whitespace or a stray bracket.
 */
export function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\/[^\s[/]+$/i.test(value.trim());
}

/* -------------------------------------------------------------------------- */
/*  2. Authentication — Clerk, Google OAuth, NextAuth-style session keys       */
/* -------------------------------------------------------------------------- */

/**
 * Session signing key. `AUTH_SECRET` is the canonical name on Vercel;
 * `NEXTAUTH_SECRET` is accepted because several tooling presets still emit it.
 */
const AUTH_SECRET_KEYS = ["AUTH_SECRET", "NEXTAUTH_SECRET"] as const;

/** Last-resort key so local dev works without any configuration. */
const DEV_ONLY_AUTH_SECRET = "bgmi-dev-only-insecure-secret-change-me";

/** HMAC key used to sign the `bgmi_session` cookie. */
export function getAuthSecret(): string {
  const secret = firstEnv(AUTH_SECRET_KEYS);
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[env] AUTH_SECRET is not set — sessions are signed with an insecure development " +
        "secret. Add AUTH_SECRET (openssl rand -base64 32) to your environment and redeploy.",
    );
  }
  return DEV_ONLY_AUTH_SECRET;
}

/**
 * `true` when `AUTH_SECRET` (or `NEXTAUTH_SECRET`) is explicitly set.
 * `getAuthSecret()` always returns a usable key, so diagnostics need this to
 * tell a configured deployment from one running on the dev-only fallback.
 */
export function isAuthSecretConfigured(): boolean {
  return Boolean(firstEnv(AUTH_SECRET_KEYS));
}

/**
 * Canonical site URL (`NEXTAUTH_URL`), without a trailing slash.
 *
 * Returns `undefined` when the variable is unset OR not a valid absolute URL,
 * so a mis-pasted value can never poison the OAuth redirect fallback — an
 * invalid URL is treated as "not configured" and the request origin is used
 * instead, which at least keeps sign-in working.
 */
export function getNextAuthUrl(): string | undefined {
  const raw = firstEnv(["NEXTAUTH_URL"]);
  if (!raw) return undefined;

  const url = raw.replace(/\/+$/, "");
  if (!isAbsoluteHttpUrl(url)) {
    console.error(
      `[env] NEXTAUTH_URL is not a valid URL: ${JSON.stringify(raw)}. ` +
        `Set it to a plain absolute URL such as "https://your-domain.com" (no brackets, no trailing slash).`,
    );
    return undefined;
  }
  return url;
}

/** Raw `NEXTAUTH_URL` as configured — kept so diagnostics can show the bad value. */
export function getRawNextAuthUrl(): string | undefined {
  return firstEnv(["NEXTAUTH_URL"]);
}

/**
 * Owner Google accounts — comma-separated allow-list from `OWNER_EMAIL`.
 * Only these accounts receive the `owner` role.
 */
const DEFAULT_OWNER_EMAILS = ["manavjeph800@gmail.com"];

export function getOwnerEmails(): string[] {
  const raw = firstEnv(["OWNER_EMAIL"]);
  const emails = (raw ?? DEFAULT_OWNER_EMAILS.join(","))
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return emails.length > 0 ? emails : DEFAULT_OWNER_EMAILS;
}

/** `true` when `OWNER_EMAIL` is explicitly set (a default owner exists otherwise). */
export function isOwnerEmailConfigured(): boolean {
  return Boolean(firstEnv(["OWNER_EMAIL"]));
}

/* -------------------------------------------------------------------------- */
/*  2a. Clerk                                                                  */
/* -------------------------------------------------------------------------- */

export type ClerkConfig = {
  /** Server-side key — never expose to the browser. */
  secretKey: string;
  /** Publishable key — safe to ship in the client bundle. */
  publishableKey: string;
  /** `true` only when BOTH keys are present. */
  isConfigured: boolean;
};

/**
 * Clerk credentials — read purely for configuration validation.
 * The store's own sign-in is the custom Google OAuth + PKCE flow.
 */
export function getClerkConfig(): ClerkConfig {
  const secretKey = firstEnv(["CLERK_SECRET_KEY"]) ?? "";
  const publishableKey = firstEnv(["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]) ?? "";
  return { secretKey, publishableKey, isConfigured: Boolean(secretKey && publishableKey) };
}

/* -------------------------------------------------------------------------- */
/*  2b. Google OAuth 2.0                                                       */
/* -------------------------------------------------------------------------- */

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  /** `GOOGLE_REDIRECT_URI` — may be empty (origin-based fallback is used). */
  redirectUri: string;
  /** `true` when the client id + secret are both present. */
  isConfigured: boolean;
};

/** Production OAuth callback — last-resort fallback. */
const PRODUCTION_GOOGLE_CALLBACK = "https://battlegroundmobilesindia.shop/auth/google/callback";

export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  const clientId = firstEnv(["GOOGLE_CLIENT_ID"]) ?? "";
  const clientSecret = firstEnv(["GOOGLE_CLIENT_SECRET"]) ?? "";
  const redirectUri = firstEnv(["GOOGLE_REDIRECT_URI"]) ?? "";
  return { clientId, clientSecret, redirectUri, isConfigured: Boolean(clientId && clientSecret) };
}

/**
 * Absolute redirect URI for the OAuth callback.
 *
 * Resolution order:
 *   1. `GOOGLE_REDIRECT_URI` — must match an Authorized redirect URI exactly.
 *   2. `NEXTAUTH_URL` + `/auth/google/callback`, but only when `NEXTAUTH_URL`
 *      points at the host that is actually serving the request.
 *   3. The incoming request's origin — keeps local dev and previews working.
 *   4. The canonical production callback (only when no request URL is known).
 */
export function getGoogleRedirectUri(requestUrl?: string): string {
  const configured = getGoogleOAuthConfig().redirectUri;
  if (configured) return configured;

  const siteUrl = getNextAuthUrl();

  if (requestUrl) {
    try {
      const origin = new URL(requestUrl).origin;
      if (siteUrl && new URL(siteUrl).origin === origin) return `${siteUrl}/auth/google/callback`;
      return `${origin}/auth/google/callback`;
    } catch {
      /* fall through to the canonical callback below */
    }
  }

  return siteUrl ? `${siteUrl}/auth/google/callback` : PRODUCTION_GOOGLE_CALLBACK;
}
