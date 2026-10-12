/**
 * `db.execute(sql\`...\`)` resolves to the raw driver result (`{ rows, ... }`)
 * on both the Neon HTTP driver (production) and node-postgres (local). This
 * helper hides that difference so callers can read `rows` the same way.
 */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown } | null | undefined)?.rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

/**
 * Postgres error 23505 — unique_violation.
 *
 * Drizzle wraps driver errors, so the `code` often sits on `error.cause`
 * instead of the top-level object. Walk a short cause chain to catch both.
 */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && typeof current === "object" && current !== null; depth += 1) {
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
