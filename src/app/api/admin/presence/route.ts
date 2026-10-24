import { NextResponse, type NextRequest } from "next/server";
import { requireAdminScope } from "@/lib/admin-auth";
import { touchAdminPresence } from "@/lib/admin-presence";

export const dynamic = "force-dynamic";

/**
 * Staff presence heartbeat for the support desk.
 *
 * The admin dashboard POSTs every ~15s with the ticket currently open (or
 * `null`). Telegram alerts stay silent while a ticket is being read — see
 * `lib/support-alerts.ts`.
 *
 * POST /api/admin/presence { ticketId?: string | null }
 */
export async function POST(request: NextRequest) {
  const identity = await requireAdminScope(request, "tickets");
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const raw = typeof body?.ticketId === "string" ? body.ticketId.trim() : "";
  const ticketId = /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;

  await touchAdminPresence(identity.email, ticketId).catch(() => undefined);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
