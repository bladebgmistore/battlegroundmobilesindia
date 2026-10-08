import { NextResponse, type NextRequest } from "next/server";
import { requireAdminScope } from "@/lib/admin-auth";
import { getAdminReferralOverview } from "@/lib/referrals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Staff (owner / admin / manager): referral tree, commission logs and headline numbers. */
export async function GET(request: NextRequest) {
  if (!(await requireAdminScope(request, "referrals"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const overview = await getAdminReferralOverview();
    if (!overview) return NextResponse.json({ error: "Database offline." }, { status: 503 });
    return NextResponse.json({ ok: true, ...overview }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin referral overview failed:", error);
    return NextResponse.json({ error: "Could not load referrals." }, { status: 500 });
  }
}
