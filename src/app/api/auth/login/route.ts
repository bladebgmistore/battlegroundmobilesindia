import { NextResponse, type NextRequest } from "next/server";
import {
  findUserByIdentifier,
  toUserRecord,
  verifyUserPassword,
  applyUserCookie,
  persistUserSession,
} from "@/lib/user-store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const identifier = String(body?.identifier ?? "").trim();
    const password = String(body?.password ?? "");

    if (!identifier || !password) {
      return NextResponse.json({ error: "Enter your email/WhatsApp and password." }, { status: 400 });
    }

    const user = await findUserByIdentifier(identifier);
    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const valid = await verifyUserPassword(user, password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const record = toUserRecord(user);
    const token = await persistUserSession(request, record);
    const secure =
      request.nextUrl.protocol === "https:" ||
      request.headers.get("x-forwarded-proto") === "https";
    const response = NextResponse.json({ ok: true, user: record });
    applyUserCookie(response, token, secure);

    return response;
  } catch {
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
