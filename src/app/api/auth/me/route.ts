import { NextResponse, type NextRequest } from "next/server";
import { USER_COOKIE, verifyUserToken } from "@/lib/user-session";
import { findUserById, toUserRecord } from "@/lib/user-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(USER_COOKIE)?.value;
  const identity = token ? verifyUserToken(token) : null;
  if (!identity) {
    return NextResponse.json({ authenticated: false });
  }

  // Load fresh data so profile edits are reflected immediately.
  const user = await findUserById(identity.id);
  if (!user || !user.isActive) {
    // Token stale or account disabled — treat as logged out.
    const response = NextResponse.json({ authenticated: false });
    response.cookies.set({ name: USER_COOKIE, value: "", httpOnly: true, path: "/", maxAge: 0 });
    return response;
  }

  return NextResponse.json({ authenticated: true, user: toUserRecord(user) });
}
