# Legacy single-database migrations (archived)

These SQL files belong to the **old single-database** setup (one `DATABASE_URL`
for every table). They are kept only for historical reference and for teams
that still have a single consolidated Postgres database to inspect.

The app now uses **three separate Neon databases**, provisioned from the
partitioned Drizzle schemas:

| Database | Schema | Environment variable |
|---|---|---|
| DB1 — users, auth, profiles, roles | `src/db/schemas/db1.ts` | `DATABASE_URL_DB1` |
| DB2 — inventory, products, categories, pricing | `src/db/schemas/db2.ts` | `DATABASE_URL_DB2` |
| DB3 — orders, payments, proofs, referral points | `src/db/schemas/db3.ts` | `DATABASE_URL_DB3` |

Use `npm run db:push` (or `npm run db:init` for a seeded starter store) instead
of running these files. Do **not** apply them to the new databases: several
statements assume every table lives in the same Postgres database and will fail
across the DB1/DB2/DB3 split.

Generated, per-database DDL lives in `drizzle/db1/`, `drizzle/db2/` and
`drizzle/db3/`.
