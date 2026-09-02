import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, database: "up" });
  } catch {
    // App can still run with fallbacks; health remains ok for platform checks.
    return Response.json({ ok: true, database: "down" });
  }
}
