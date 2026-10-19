/**
 * Re-export barrel for all 3 partitioned databases.
 * Keeps `import { users, orders } from "@/db/schema"` working everywhere.
 *
 * Partition:
 *  DB1 — src/db/schemas/db1.ts (auth, users, staff, logs)
 *  DB2 — src/db/schemas/db2.ts (inventory, products, pricing)
 *  DB3 — src/db/schemas/db3.ts (orders, transactions, proofs, referrals)
 */
export * from "./schemas/db1";
export * from "./schemas/db2";
export * from "./schemas/db3";
