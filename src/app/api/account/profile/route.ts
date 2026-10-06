import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, updateUserProfile } from "@/lib/user-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, user });
}

/** Name + WhatsApp are editable; the email is owned by the Google account. */
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const result = await updateUserProfile(user.id, { name: body?.name, whatsapp: body?.whatsapp });
  if (result.error || !result.user) {
    return NextResponse.json({ error: result.error ?? "Could not update profile." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, user: result.user });
}
