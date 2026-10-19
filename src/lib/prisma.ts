/**
 * Prisma-compatible alias for unified database client.
 * Project uses Drizzle ORM, but requirement mentions `lib/prisma.ts` as example
 * location — this file ensures that path also exposes the failover client.
 *
 * @deprecated Import from `@/db` or `@/lib/db` directly.
 */
export * from "./db";
export { db as prisma } from "@/db";
export { db as default } from "@/db";
