import { NextResponse, type NextRequest } from "next/server";
import { requestPasswordReset } from "@/lib/user-password-reset";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const identifier = String(body?.identifier ?? "").trim();
    const result = await requestPasswordReset(identifier);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Could not send a reset code." }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      delivered: result.delivered,
      deliveryMode: result.deliveryMode,
      demoOtp: result.demoOtp,
    });
  } catch {
    return NextResponse.json({ error: "Could not send a reset code. Please try again." }, { status: 500 });
  }
}
