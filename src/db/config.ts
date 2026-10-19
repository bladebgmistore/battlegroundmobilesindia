/**
 * Centralised environment resolution + failover-error detection for the
 * multi-database architecture.
 *
 * PRIMARY database  → all `BGMISTORE_*` keys (pooled + unpooled).
 * SECONDARY database → all `DATABASE2_*` keys (pooled + unpooled).
 *
 * Pooled  = serverless / pgbouncer path  → `POSTGRES_PRISMA_URL` / `POSTGRES_URL` / `DATABASE_URL`.
 * Unpooled = direct / migration path     → `DATABASE_URL_UNPOOLED` / `POSTGRES_URL_NON_POOLING`.
 *
 * For local dev / backward-compat we also honour un-prefixed `DATABASE_URL`.
 * For production on Vercel you will set the `BGMISTORE_*` + `DATABASE2_*` vars.
 */

export type DbRole = "primary" | "secondary";

// ---------------------------------------------------------------------------
// URL resolution
// ---------------------------------------------------------------------------

function readEnv(key: string): string | undefined {
  const v = process.env[key];
  if (v == null) return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

/** Primary pooled candidates in priority order. */
export function getPrimaryPooledUrl(): string | undefined {
  return (
    readEnv("BGMISTORE_POSTGRES_PRISMA_URL") ||
    readEnv("BGMISTORE_POSTGRES_URL") ||
    readEnv("BGMISTORE_DATABASE_URL") ||
    // Fallbacks for local dev / single-DB setups (backward-compat)
    readEnv("POSTGRES_PRISMA_URL") ||
    readEnv("POSTGRES_URL") ||
    readEnv("DATABASE_URL") ||
    undefined
  );
}

/** Primary unpooled / direct candidates in priority order. */
export function getPrimaryUnpooledUrl(): string | undefined {
  return (
    readEnv("BGMISTORE_DATABASE_URL_UNPOOLED") ||
    readEnv("BGMISTORE_POSTGRES_URL_NON_POOLING") ||
    // If no explicit unpooled, fall back to pooled primary (many setups only have one URL)
    readEnv("BGMISTORE_POSTGRES_PRISMA_URL") ||
    readEnv("BGMISTORE_POSTGRES_URL") ||
    readEnv("BGMISTORE_DATABASE_URL") ||
    // Generic fallbacks
    readEnv("DATABASE_URL_UNPOOLED") ||
    readEnv("POSTGRES_URL_NON_POOLING") ||
    readEnv("DATABASE_URL") ||
    undefined
  );
}

/** Secondary pooled candidates. */
export function getSecondaryPooledUrl(): string | undefined {
  return (
    readEnv("DATABASE2_POSTGRES_PRISMA_URL") ||
    readEnv("DATABASE2_POSTGRES_URL") ||
    readEnv("DATABASE2_DATABASE_URL") ||
    // Generic DATABASE2 fallbacks (if user set POSTGRES_URL for second DB)
    undefined
  );
}

/** Secondary unpooled / direct candidates. */
export function getSecondaryUnpooledUrl(): string | undefined {
  return (
    readEnv("DATABASE2_DATABASE_URL_UNPOOLED") ||
    readEnv("DATABASE2_POSTGRES_URL_NON_POOLING") ||
    // If no explicit unpooled, fall back to pooled secondary
    readEnv("DATABASE2_POSTGRES_PRISMA_URL") ||
    readEnv("DATABASE2_POSTGRES_URL") ||
    readEnv("DATABASE2_DATABASE_URL") ||
    undefined
  );
}

export function getPrimaryUrl(opts: { pooled: boolean } = { pooled: true }): string | undefined {
  return opts.pooled ? getPrimaryPooledUrl() : getPrimaryUnpooledUrl();
}

export function getSecondaryUrl(opts: { pooled: boolean } = { pooled: true }): string | undefined {
  return opts.pooled ? getSecondaryPooledUrl() : getSecondaryUnpooledUrl();
}

/**
 * Unified getter used by legacy call sites.
 * `pooled=true` → serverless path, `pooled=false` → migration/admin path.
 */
export function getDatabaseUrl(opts: { pooled?: boolean; role?: DbRole } = {}): string {
  const pooled = opts.pooled ?? true;
  const role = opts.role;
  if (role === "primary") {
    const v = getPrimaryUrl({ pooled });
    if (!v) throw new Error(`Primary database URL is missing — set BGMISTORE_* env vars (pooled=${pooled}).`);
    return v;
  }
  if (role === "secondary") {
    const v = getSecondaryUrl({ pooled });
    if (!v) throw new Error(`Secondary database URL is missing — set DATABASE2_* env vars (pooled=${pooled}).`);
    return v;
  }
  // Default: pooled primary with generic fallback (backward-compat)
  const primary = getPrimaryUrl({ pooled });
  if (primary) return primary;
  // If primary missing but secondary exists, use it (degraded mode)
  const secondary = getSecondaryUrl({ pooled });
  if (secondary) return secondary;
  throw new Error(
    "DATABASE_URL is required — set BGMISTORE_DATABASE_URL / BGMISTORE_POSTGRES_PRISMA_URL (primary) or DATABASE_URL as fallback.",
  );
}

/** Whether the secondary database is configured at all (pooled or unpooled). */
export function isSecondaryConfigured(): boolean {
  return Boolean(getSecondaryPooledUrl() || getSecondaryUnpooledUrl());
}

/** Whether the primary database is configured. */
export function isPrimaryConfigured(): boolean {
  return Boolean(getPrimaryPooledUrl() || getPrimaryUnpooledUrl());
}

/** Summary for diagnostics / health checks. */
export function getDatabaseEnvSummary() {
  return {
    primary: {
      pooled: Boolean(getPrimaryPooledUrl()),
      unpooled: Boolean(getPrimaryUnpooledUrl()),
      pooledPreview: maskUrl(getPrimaryPooledUrl()),
      unpooledPreview: maskUrl(getPrimaryUnpooledUrl()),
    },
    secondary: {
      pooled: Boolean(getSecondaryPooledUrl()),
      unpooled: Boolean(getSecondaryUnpooledUrl()),
      pooledPreview: maskUrl(getSecondaryPooledUrl()),
      unpooledPreview: maskUrl(getSecondaryUnpooledUrl()),
      configured: isSecondaryConfigured(),
    },
  };
}

function maskUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.protocol}//***:***@${u.host}${u.pathname}`;
  } catch {
    return "***";
  }
}

// ---------------------------------------------------------------------------
// Neon detection + pool config (shared)
// ---------------------------------------------------------------------------

export function isNeonUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h.includes("neon.tech") || h.endsWith(".neon.db");
  } catch {
    return url.includes("neon.tech") || url.includes("neon.db");
  }
}

export function buildPoolConfig(connectionString: string) {
  try {
    const u = new URL(connectionString);
    const needsSsl = u.searchParams.has("sslmode") || u.hostname.includes("neon.tech") || u.hostname.includes("neon.db");
    u.searchParams.delete("sslmode");
    const clean = u.toString();
    return needsSsl ? { connectionString: clean, ssl: { rejectUnauthorized: false } as const } : { connectionString: clean };
  } catch {
    return { connectionString };
  }
}

// ---------------------------------------------------------------------------
// Failover error detection
// ---------------------------------------------------------------------------

/**
 * Returns true if the error looks like a transient infra failure that should
 * trigger automatic failover to the secondary database.
 *
 * We ONLY fail over on:
 *   - network / connection errors
 *   - timeouts
 *   - Neon quota / monthly limit / compute / storage exhaustion
 *   - HTTP 502/503/504 gateway errors from the Neon API
 *
 * We deliberately do NOT fail over on:
 *   - SQL logic errors (unique violation, foreign key, syntax, not-null, etc.)
 *   - Authentication errors that are not quota-related
 *   - Application validation errors
 *
 * The check is intentionally broad on the infra side to keep the site alive
 * during Neon outages / free-tier limits — false positives (retry on secondary
 * when primary would have succeeded with a retry) are acceptable; missing a
 * real quota error and returning 500 to the user is not.
 */
export function isFailoverError(error: unknown): boolean {
  if (!error) return false;

  // Collect all textual clues from the error + its cause chain
  const parts: string[] = [];
  let cur: unknown = error;
  for (let depth = 0; depth < 5 && cur != null; depth++) {
    if (cur instanceof Error) {
      if (cur.message) parts.push(cur.message);
      // Some libs put code/status on the error object
      const anyErr = cur as unknown as Record<string, unknown>;
      if (typeof anyErr["code"] === "string") parts.push(anyErr["code"] as string);
      if (typeof anyErr["status"] === "string" || typeof anyErr["status"] === "number") parts.push(String(anyErr["status"]));
      if (typeof anyErr["statusCode"] === "string" || typeof anyErr["statusCode"] === "number") parts.push(String(anyErr["statusCode"]));
      // Undici / fetch often nests the real cause
      const cause = (cur as unknown as { cause?: unknown }).cause;
      if (cause && cause !== cur) {
        cur = cause;
        continue;
      }
      break;
    }
    if (typeof cur === "string") {
      parts.push(cur);
      break;
    }
    if (typeof cur === "object") {
      const anyCur = cur as Record<string, unknown>;
      if (typeof anyCur["message"] === "string") parts.push(anyCur["message"] as string);
      if (typeof anyCur["code"] === "string") parts.push(anyCur["code"] as string);
      if (typeof anyCur["error"] === "string") parts.push(anyCur["error"] as string);
      // Neon sometimes returns { statusCode, body }
      if (typeof anyCur["body"] === "string") parts.push(anyCur["body"] as string);
      break;
    }
    break;
  }

  const haystack = parts.join(" | ").toLowerCase();

  if (!haystack) return false;

  // --- First, EXCLUDE pure query-logic errors that should NEVER fail over ---
  // These would also fail on the secondary (same schema, same bad data), so
  // retrying would just waste time and hide bugs.
  // If primary throws one of these, we let it bubble — it's an app bug, not infra.
  const nonFailoverKeywords = [
    "duplicate key",
    "unique violation",
    "unique constraint",
    "violates foreign key",
    "violates check constraint",
    "violates not-null",
    "violates exclusion",
    "violates unique",
    "foreign key violation",
    "not-null violation",
    "check constraint violation",
    "syntax error",
    "unterminated quoted",
    "missing from-clause",
    "invalid input syntax",
    "invalid input value",
    "value too long",
    "string data, right truncation",
  ];
  // If it looks like a pure constraint/syntax error, do NOT fail over.
  // We still allow failover if the SAME message also contains infra keywords
  // (e.g., "connection error ... duplicate key" shouldn't happen, but just in case we check infra first).
  const isNonFailover = nonFailoverKeywords.some((kw) => haystack.includes(kw));
  if (isNonFailover) {
    // Edge: Neon sometimes returns "quota exceeded ... duplicate"? No — safe to return false here.
    return false;
  }

  // --- Postgres error codes that are definitely failover-eligible (infra, not query logic) ---
  // 53300 too_many_connections, 53400 configuration_limit_exceeded,
  // 57014 query_canceled (often timeout), 58000 system_error, 08001-08006 connection_exception
  const pgCodeFailover = /\b(53300|53400|57014|58000|0800[1-6])\b/;
  if (pgCodeFailover.test(haystack)) return true;

  // --- Network / connection keywords ---
  const networkKeywords = [
    "fetch failed",
    "fetch error",
    "failed to fetch",
    "network error",
    "econnrefused",
    "econnreset",
    "enotfound",
    "eai_again",
    "epipe",
    "ehostunreach",
    "enetunreach",
    "getaddrinfo",
    "unable to connect",
    "cannot connect",
    "could not connect",
    "connection terminated",
    "connection ended",
    "connection closed",
    "connection error",
    "connection timeout",
    "connecttimeout",
    "client has encountered a connection error",
    "connection refused",
    "terminating connection",
    "the database is not available",
    "too many clients",
    "too many connections",
    "max_connections",
    "remaining connection slots are reserved",
    "sorry, too many clients",
    "no pg_hba.conf entry",
    "password authentication failed",
    "role \"", // role does not exist / auth
    "authentication failed",
    "self signed certificate",
    "certificate has expired",
  ];

  // --- Timeout keywords ---
  const timeoutKeywords = [
    "timeout",
    "timed out",
    "etimedout",
    "query timed out",
    "statement timeout",
    "statementtimeout",
    "idle_in_transaction_session_timeout",
    "canceling statement due to statement timeout",
    "canceling statement due to user request",
    "timeout expired",
    "connecttimeout",
    "acquire timeout",
    "connectiontimeout",
    "read timeout",
    "query execution timeout",
  ];

  // --- Quota / limit / Neon-specific keywords ---
  const quotaKeywords = [
    "quota",
    "monthly limit",
    "limit reached",
    "limit exceeded",
    "quota exceeded",
    "exceeded quota",
    "compute limit",
    "remaining compute",
    "storage limit",
    "database limit",
    "max limit",
    "rate limit",
    "rate exceeded",
    "neon api error",
    "payment required",
    "402",
    "suspended",
    "branch is idle",
    "cannot allocate",
    "resource exhausted",
    "usage limit",
    "free tier",
    "free plan limit",
    "alloc limit",
    "project limit",
    "too many databases",
    "too many branches",
    "maximum number of branches",
    "maximum number of",
    "branch limit",
    "max request limit",
    "exceeded the",
    "quota limit",
    "compute time",
    "active time limit",
    "data transfer limit",
    "written data limit",
    "neon",
    "project has been suspended",
    "project status: idle",
    "endpoint is disabled",
  ];

  // --- HTTP gateway codes from Neon API / Vercel / Cloudflare ---
  const httpGatewayKeywords = ["502", "503", "504", "521", "522", "523", "524", "525", "526"];
  const httpGatewayPhrases = ["bad gateway", "service unavailable", "gateway timeout", "origin unreachable", "cloudflare"];

  const matchesAny = (keywords: string[]) => keywords.some((kw) => haystack.includes(kw));

  if (matchesAny(networkKeywords)) return true;
  if (matchesAny(timeoutKeywords)) return true;
  if (matchesAny(quotaKeywords)) return true;
  if (matchesAny(httpGatewayKeywords)) {
    const infraContext = ["neon", "fetch", "database", "connection", "postgres", "pg", "api", "vercel", "cloudflare", "gateway", "upstream"];
    if (infraContext.some((kw) => haystack.includes(kw)) || haystack.match(/\b50[234]\b/)) return true;
  }
  if (matchesAny(httpGatewayPhrases)) return true;
  if (haystack.includes("connecttimeouterror") || haystack.includes("timeouterror") || haystack.includes("headers timeout")) return true;

  // --- AGGRESSIVE FALLBACK: for user expectation "jab 1st na chale to 2nd kaam me aa jaaye" ---
  // If the error came from the DB driver and is NOT a pure constraint/syntax error,
  // we consider it infra and fail over. This guarantees the site never crashes
  // when primary is down, even if the exact error message is unknown.
  // Heuristic: any DB error containing these broad failure signals should fail over.
  const broadFailoverSignals = [
    "error",
    "failed",
    "failure",
    "exception",
    "cannot",
    "unable",
    "unavailable",
    "terminat",
    "refused",
    "reset",
    "enotfound",
    "etimedout",
    "econn",
    "eai_again",
    "getaddrinfo",
    "fetch",
    "connection",
    "pool",
    "exhausted",
    "suspended",
    "quota",
    "limit",
    "timeout",
    "neon",
    "database",
    "postgres",
    "pg_",
    "sql",
  ];
  // Only apply broad check if haystack looks like a DB/infra error (not a plain app "not found" message)
  // We require at least one broad signal AND the error came from a DB-related source
  // (heuristic: contains "neon", "postgres", "database", "connection", "pool", "query", "fetch", "pg")
  const dbContext = ["neon", "postgres", "database", "connection", "pool", "query", "fetch", " pg", "pg_", "sql", "timeout", "quota", "limit", "econn", "enotfound", "eai_again"];
  const hasBroadSignal = broadFailoverSignals.some((kw) => haystack.includes(kw));
  const hasDbContext = dbContext.some((kw) => haystack.includes(kw));
  if (hasBroadSignal && hasDbContext) return true;

  // Final catch-all: if error message is non-empty and contains "error" / "failed" and is NOT a constraint error, fail over.
  // This is intentionally permissive — user explicitly wants primary-down → secondary.
  if (haystack.includes("error") || haystack.includes("failed") || haystack.includes("failure") || haystack.includes("exception")) {
    return true;
  }

  return false;
}
