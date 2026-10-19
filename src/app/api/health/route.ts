import { db, getDatabaseStatus } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    // If we reach here the failover client succeeded (primary or secondary)
    const status = await getDatabaseStatus().catch(() => null);
    return Response.json({
      ok: true,
      database: "up",
      active: status?.active ?? "unknown",
      primary: status?.primary ?? null,
      secondary: status?.secondary ?? null,
    });
  } catch {
    // Even with failover both DBs could be down — health should still return ok
    // for platform checks but report database:down so monitors can alert.
    const status = await getDatabaseStatus().catch(() => null);
    return Response.json({
      ok: true,
      database: "down",
      active: status?.active ?? "none",
      primary: status?.primary ?? null,
      secondary: status?.secondary ?? null,
    });
  }
}
