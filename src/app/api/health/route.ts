import { db1, db2, db3 } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Health check across all 3 databases
    await Promise.all([db1.execute(sql`select 1`), db2.execute(sql`select 1`), db3.execute(sql`select 1`)]);
    return Response.json({ ok: true, database: "up", databases: { db1: "up", db2: "up", db3: "up" } });
  } catch {
    try {
      const results = await Promise.allSettled([db1.execute(sql`select 1`), db2.execute(sql`select 1`), db3.execute(sql`select 1`)]);
      const status = {
        db1: results[0].status === "fulfilled" ? "up" : "down",
        db2: results[1].status === "fulfilled" ? "up" : "down",
        db3: results[2].status === "fulfilled" ? "up" : "down",
      };
      const anyUp = Object.values(status).some((s) => s === "up");
      return Response.json({ ok: anyUp, database: anyUp ? "degraded" : "down", databases: status });
    } catch {
      return Response.json({ ok: true, database: "down" });
    }
  }
}
