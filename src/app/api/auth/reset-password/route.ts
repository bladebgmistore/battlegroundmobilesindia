import { NextResponse, type NextRequest } from "next/server";
import { findUserByIdentifier, setUserPassword } from "@/lib/user-store";
import { verifyPasswordResetOtp, consumePasswordResetTokens } from "@/lib/user-password-reset";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const identifier = String(body?.identifier ?? "").trim();
    const otp = String(body?.otp ?? "").trim();
    const newPassword = String(body?.newPassword ?? "");

    if (!identifier || !otp || !newPassword) {
      return NextResponse.json({ error: "Email, code and new password are required." }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters long." }, { status: 400 });
    }

    const user = await findUserByIdentifier(identifier);
    if (!user) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const valid = await verifyPasswordResetOtp(identifier, otp);
    if (!valid) {
      return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
    }

    const result = await setUserPassword(user.id, newPassword);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Could not reset password." }, { status: 400 });
    }

    await consumePasswordResetTokens(identifier);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not reset password. Please try again." }, { status: 500 });
  }
}
