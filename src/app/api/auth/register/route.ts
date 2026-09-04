import { NextResponse, type NextRequest } from "next/server";
import { createUser, applyUserCookie, persistUserSession } from "@/lib/user-store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const email = body?.email ? String(body.email).trim() : null;
    const whatsapp = body?.whatsapp ? String(body.whatsapp).trim() : null;
    const password = String(body?.password ?? "");

    const { user, error } = await createUser({ name, email, whatsapp, password });
    if (error || !user) {
      return NextResponse.json({ error: error ?? "Could not create account." }, { status: 400 });
    }

    const token = await persistUserSession(request, user);
    const secure =
      request.nextUrl.protocol === "https:" ||
      request.headers.get("x-forwarded-proto") === "https";
    const response = NextResponse.json({ ok: true, user });
    applyUserCookie(response, token, secure);

    return response;
  } catch {
    return NextResponse.json({ error: "Sign-up failed. Please try again." }, { status: 500 });
  }
}
