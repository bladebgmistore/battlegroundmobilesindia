import { db3 } from "@/db";
import { adminPresence } from "@/db/schema";
import { and, eq, gt, sql } from "drizzle-orm";

/**
 * Live staff presence for the support desk.
 *
 * The admin dashboard heartbeats every ~15s with the ticket it currently has
 * open. Telegram alerts use this to stay silent while somebody is actually
 * reading the conversation.
 *
 * The table is created idempotently (same pattern as the other `ensure*`
 * helpers), so a fresh DB3 needs no manual migration.
 */
type G = typeof globalThis & { __bgmiPresenceTableReady?: Promise<boolean> };

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS admin_presence (
    email varchar(180) PRIMARY KEY,
    active_ticket_id uuid,
    last_seen_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS admin_presence_seen_idx ON admin_presence (last_seen_at DESC)`,
];

/** A heartbeat older than this is considered offline. */
export const PRESENCE_FRESH_MS = 45_000;

export function ensurePresenceTable(): Promise<boolean> {
  const g = globalThis as G;
  if (g.__bgmiPresenceTableReady) return g.__bgmiPresenceTableReady;

  g.__bgmiPresenceTableReady = (async () => {
    try {
      for (const statement of STATEMENTS) {
        await db3.execute(sql.raw(statement));
      }
      return true;
    } catch {
      g.__bgmiPresenceTableReady = undefined;
      return false;
    }
  })();

  return g.__bgmiPresenceTableReady;
}

/** Upsert one staff member's heartbeat (called by the admin dashboard). */
export async function touchAdminPresence(email: string, activeTicketId?: string | null): Promise<void> {
  if (!email) return;
  const ready = await ensurePresenceTable();
  if (!ready) return;
  const normalized = email.trim().toLowerCase().slice(0, 180);

  await db3.insert(adminPresence)
    .values({ email: normalized, activeTicketId: activeTicketId ?? null, lastSeenAt: new Date() })
    .onConflictDoUpdate({
      target: adminPresence.email,
      set: { activeTicketId: activeTicketId ?? null, lastSeenAt: new Date() },
    });
}

/** True while a staff member has THIS ticket open (fresh heartbeat). */
export async function isAdminViewingTicket(ticketId: string): Promise<boolean> {
  if (!ticketId) return false;
  try {
    const ready = await ensurePresenceTable();
    if (!ready) return false;
    const cutoff = new Date(Date.now() - PRESENCE_FRESH_MS);
    const [row] = await db3.select({ email: adminPresence.email })
      .from(adminPresence)
      .where(and(eq(adminPresence.activeTicketId, ticketId), gt(adminPresence.lastSeenAt, cutoff)))
      .limit(1);
    return Boolean(row);
  } catch {
    return false;
  }
}

/** True while ANY staff member is in the admin area (fresh heartbeat). */
export async function isAnyAdminOnline(): Promise<boolean> {
  try {
    const ready = await ensurePresenceTable();
    if (!ready) return false;
    const cutoff = new Date(Date.now() - PRESENCE_FRESH_MS);
    const [row] = await db3.select({ email: adminPresence.email })
      .from(adminPresence)
      .where(gt(adminPresence.lastSeenAt, cutoff))
      .limit(1);
    return Boolean(row);
  } catch {
    return false;
  }
}
