import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, changeUserPassword } from "@/lib/user-store";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const result = await changeUserPassword(
      user.id,
      String(body?.currentPassword ?? ""),
      String(body?.newPassword ?? ""),
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Could not change password." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not change password." }, { status: 500 });
  }
}
