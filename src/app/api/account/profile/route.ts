import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, toUserRecord, updateUserProfile } from "@/lib/user-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, user: toUserRecord(user) });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const result = await updateUserProfile(user.id, {
      name: body?.name,
      email: body?.email,
      whatsapp: body?.whatsapp,
    });
    if (result.error || !result.user) {
      return NextResponse.json({ error: result.error ?? "Could not update profile." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, user: result.user });
  } catch {
    return NextResponse.json({ error: "Could not update profile." }, { status: 500 });
  }
}
