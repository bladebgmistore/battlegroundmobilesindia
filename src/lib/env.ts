/**
 * Single source of truth for every environment variable this project reads.
 *
 * The store is deployed on Vercel with a Neon/Vercel-Postgres database whose
 * integration keys are all prefixed `BGMISTORE_*`, plus Clerk / Google auth
 * keys. Resolving every variable in ONE module means:
 *
 *   - there is exactly one file to audit when the hosting dashboard changes;
 *   - renaming a key (e.g. `DATABASE_URL` → `BGMISTORE_DATABASE_URL`) is a
 *     one-line edit instead of a repo-wide search;
 *   - the fallback chains (pooled vs. direct, URL vs. discrete credentials)
 *     are documented and testable in one place.
 *
 * Edge-safe by design: this file only touches `process.env`, so it can be
 * imported from the proxy (Edge runtime), route handlers (Node runtime),
 * server components and the Drizzle CLI config alike.
 *
 * Required variables are documented in `.env.example`.
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

/**
 * Assemble a PostgreSQL connection string from the discrete credentials a
 * Vercel/Neon integration also injects (`*_POSTGRES_USER`, `*_PGHOST`, …).
 * Only used when no full `*_URL` variable is present.
 */
function buildUrlFromParts(parts: {
  user?: string;
  password?: string;
  host?: string;
  database?: string;
}): string | undefined {
  if (!parts.host || !parts.database) return undefined;

  const user = encodeURIComponent(parts.user || "postgres");
  const password = parts.password ? `:${encodeURIComponent(parts.password)}` : "";
  const database = encodeURIComponent(parts.database);
  // Local sockets must stay plain; every remote host needs TLS.
  const isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?)(:\d+)?$/i.test(parts.host);
  const query = isLocal ? "" : "?sslmode=require";
  return `postgresql://${user}${password}@${parts.host}/${database}${query}`;
}

/* -------------------------------------------------------------------------- */
/*  1. Database — BGMISTORE_* keys                                            */
/* -------------------------------------------------------------------------- */

/**
 * Ordered candidates for the POOLED connection string used by the running app.
 *
 * Vercel/Neon inject several aliases for the same database; the first one that
 * is set wins. `BGMISTORE_DATABASE_URL` is the canonical key.
 */
const POOLED_URL_KEYS = [
  "BGMISTORE_DATABASE_URL",
  "BGMISTORE_POSTGRES_PRISMA_URL",
  "BGMISTORE_POSTGRES_URL",
  // ── legacy names, kept only as fallbacks so older environments keep
  //    working while the BGMISTORE_* keys roll out ──
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
] as const;

/**
 * Ordered candidates for the DIRECT (non-pooled) connection string.
 *
 * Migrations and DDL (`npx drizzle-kit push`) MUST use a direct connection:
 * PgBouncer in transaction mode cannot run `CREATE TABLE` / `ALTER TABLE`.
 */
const DIRECT_URL_KEYS = [
  "BGMISTORE_DATABASE_URL_UNPOOLED",
  "BGMISTORE_POSTGRES_URL_NON_POOLING",
  // ── legacy names ──
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
] as const;

/** Discrete pooled credentials (`BGMISTORE_POSTGRES_*` / `BGMISTORE_PG*`). */
const POOLED_PART_KEYS = {
  user: ["BGMISTORE_POSTGRES_USER", "BGMISTORE_PGUSER"],
  password: ["BGMISTORE_POSTGRES_PASSWORD", "BGMISTORE_PGPASSWORD"],
  host: ["BGMISTORE_POSTGRES_HOST", "BGMISTORE_PGHOST"],
  database: ["BGMISTORE_POSTGRES_DATABASE", "BGMISTORE_PGDATABASE"],
} as const;

/** Neon additionally exposes the unpooled endpoint as a host-only variable. */
const DIRECT_HOST_KEYS = ["BGMISTORE_PGHOST_UNPOOLED", "PGHOST_UNPOOLED"] as const;

/** Shown whenever the database is required but nothing is configured. */
export const DATABASE_CONFIG_HINT =
  "Database is not configured. Set BGMISTORE_DATABASE_URL (pooled, used by the app) " +
  "and BGMISTORE_DATABASE_URL_UNPOOLED (direct, used by migrations) in your environment.";

/**
 * Pooled connection string for the application runtime, or `undefined` when
 * nothing is configured (the storefront then serves its built-in demo data).
 */
export function getDatabaseUrl(): string | undefined {
  return firstEnv(POOLED_URL_KEYS) ?? buildUrlFromParts({
    user: firstEnv(POOLED_PART_KEYS.user),
    password: firstEnv(POOLED_PART_KEYS.password),
    host: firstEnv(POOLED_PART_KEYS.host),
    database: firstEnv(POOLED_PART_KEYS.database),
  });
}

/**
 * Direct (non-pooled) connection string for migrations and DDL.
 * Falls back to the discrete unpooled host, then to the pooled host.
 */
export function getDirectDatabaseUrl(): string | undefined {
  return (
    firstEnv(DIRECT_URL_KEYS) ??
    buildUrlFromParts({
      user: firstEnv(POOLED_PART_KEYS.user),
      password: firstEnv(POOLED_PART_KEYS.password),
      host: firstEnv(DIRECT_HOST_KEYS) ?? firstEnv(POOLED_PART_KEYS.host),
      database: firstEnv(POOLED_PART_KEYS.database),
    })
  );
}

/**
 * Connection string Drizzle CLI commands (`push`, `migrate`, `studio`) use:
 * the direct endpoint whenever one is available, else the pooled one.
 */
export function getMigrationDatabaseUrl(): string | undefined {
  return getDirectDatabaseUrl() ?? getDatabaseUrl();
}

/** Pooled connection string, throwing a descriptive error when unset. */
export function requireDatabaseUrl(): string {
  const url = getDatabaseUrl();
  if (!url) throw new Error(DATABASE_CONFIG_HINT);
  return url;
}

/** `true` when the app has a usable database connection string. */
export function isDatabaseConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}

/** Neon project id (`BGMISTORE_NEON_PROJECT_ID`) — diagnostics only. */
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
 *
 * NOTE: the previous fallback to `GOOGLE_CLIENT_SECRET` was removed — an OAuth
 * secret is not a signing key, and silently reusing it made session rotation
 * impossible. Generate one with `openssl rand -base64 32`.
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
 * Clerk credentials.
 *
 * The store's own sign-in is the custom Google OAuth + PKCE flow implemented in
 * `src/lib/google-oauth.ts` (sessions are HMAC-signed cookies, see
 * `src/lib/auth-session.ts`), so the Clerk keys are read here purely for
 * configuration validation — `/api/auth/config-check` reports whether they are
 * present so a half-configured Clerk app is caught before it ships.
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
 *      points at the host that is actually serving the request. Honouring it
 *      blindly would send a *preview* deployment's browser to the production
 *      callback, where the OAuth `state`/PKCE cookie does not exist and the
 *      sign-in would fail.
 *   3. The incoming request's origin — keeps local dev and Vercel preview
 *      deploys working without any extra configuration.
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
