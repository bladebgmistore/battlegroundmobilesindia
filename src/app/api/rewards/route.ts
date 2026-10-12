import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/user-store";
import { getPointsBalance, listRedemptionsForUser, listRewardItems } from "@/lib/rewards";
import { isUuid } from "@/lib/referrals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Signed-in customer: points balance, active store items and their own redemptions. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  if (!isUuid(user.id)) {
    return NextResponse.json(
      { ok: false, error: "Your account is still syncing. Please sign out and sign in again." },
      { status: 503 },
    );
  }

  try {
    const [items, balance, redemptions] = await Promise.all([
      listRewardItems({ activeOnly: true }),
      getPointsBalance(user.id),
      listRedemptionsForUser(user.id),
    ]);
    if (!items) {
      return NextResponse.json({ ok: false, error: "The points store is unavailable while the database is offline." }, { status: 503 });
    }
    return NextResponse.json(
      { ok: true, balance: balance ?? 0, items, redemptions },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Points store read failed:", error);
    return NextResponse.json({ ok: false, error: "Could not load the points store." }, { status: 500 });
  }
}
