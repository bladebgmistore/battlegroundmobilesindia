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

/** Postgres error 23505 — unique_violation. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}
