import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/user-store";
import { getReferralDashboard, isUuid } from "@/lib/referrals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Signed-in customer: referral code, totals, referred friends and points history. */
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
    const dashboard = await getReferralDashboard(user.id);
    if (!dashboard) {
      return NextResponse.json({ ok: false, error: "Refer & Earn is unavailable while the database is offline." }, { status: 503 });
    }
    return NextResponse.json({ ok: true, ...dashboard }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Referral dashboard failed:", error);
    return NextResponse.json({ ok: false, error: "Could not load your referral dashboard." }, { status: 500 });
  }
}
