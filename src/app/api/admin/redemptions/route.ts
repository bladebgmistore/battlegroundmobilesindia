import { NextResponse, type NextRequest } from "next/server";
import { requireAdminScope } from "@/lib/admin-auth";
import { completeRedemption, listRedemptionsForAdmin, rejectRedemption } from "@/lib/rewards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Staff: list points → UC redemption requests. `?status=pending|completed|rejected` filters the list. */
export async function GET(request: NextRequest) {
  if (!(await requireAdminScope(request, "referrals"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await listRedemptionsForAdmin(request.nextUrl.searchParams.get("status"));
    if (!data) return NextResponse.json({ error: "Database offline." }, { status: 503 });
    return NextResponse.json({ ok: true, ...data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin redemptions read failed:", error);
    return NextResponse.json({ error: "Could not load redemption requests." }, { status: 500 });
  }
}

/**
 * PATCH { id, status: "completed" | "rejected", note? }
 *  - completed: you delivered the UC to the player's UID.
 *  - rejected:  the points are refunded to the customer's balance.
 */
export async function PATCH(request: NextRequest) {
  const identity = await requireAdminScope(request, "referrals");
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = String(body?.id ?? "").trim();
  const status = String(body?.status ?? "");
  const note = String(body?.note ?? "").trim().slice(0, 255) || null;
  if (!id) return NextResponse.json({ error: "Missing redemption id." }, { status: 400 });

  try {
    if (status === "completed") {
      const result = await completeRedemption(id, identity.email);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true, status: "completed" });
    }
    if (status === "rejected") {
      const result = await rejectRedemption(id, identity.email, note);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true, status: "rejected", refunded: result.refunded });
    }
    return NextResponse.json({ error: "Status must be completed or rejected." }, { status: 400 });
  } catch (error) {
    console.error("Redemption update failed:", error);
    return NextResponse.json({ error: "Could not update this redemption." }, { status: 500 });
  }
}
