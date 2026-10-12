import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/user-store";
import { UC_UID_PATTERN, redeemReward } from "@/lib/rewards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST { itemId, playerUid, playerName? }
 * Spends points on a reward and opens a `pending` redemption request for the admin.
 * The price always comes from the database — the client only chooses the item.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const itemId = String(body?.itemId ?? "").trim();
  const playerUid = String(body?.playerUid ?? "").trim();
  const playerName = String(body?.playerName ?? "").trim().slice(0, 120) || null;

  if (!itemId) return NextResponse.json({ ok: false, error: "Choose a reward first." }, { status: 400 });
  if (!UC_UID_PATTERN.test(playerUid)) {
    return NextResponse.json({ ok: false, error: "Enter a valid BGMI UID (8-12 digits)." }, { status: 400 });
  }

  try {
    const result = await redeemReward({ userId: user.id, itemId, playerUid, playerName });
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, redemption: result.redemption, balance: result.balance }, { status: 201 });
  } catch (error) {
    console.error("Redemption failed:", error);
    return NextResponse.json({ ok: false, error: "Could not complete this redemption. Please try again." }, { status: 500 });
  }
}
