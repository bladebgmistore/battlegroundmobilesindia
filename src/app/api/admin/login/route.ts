import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, authenticateAdmin, createSessionToken } from "@/lib/admin-auth";
import { db } from "@/db";
import { adminSessions } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const identity = await authenticateAdmin(String(body?.username ?? ""), String(body?.password ?? ""));
    
    if (!identity) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    const token = createSessionToken(identity.username, identity.role);
    
    // Save session in database for stateful session checks (with 12 hour expiry)
    try {
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12);
      await db.insert(adminSessions).values({
        sessionToken: token,
        username: identity.username.toLowerCase(),
        role: identity.role,
        expiresAt,
      });
    } catch (dbError) {
      console.error("Non-blocking DB session storage failure:", dbError);
    }

    const response = NextResponse.json({ ok: true, ...identity });
    const isHttps =
      request.nextUrl.protocol === "https:" ||
      request.headers.get("x-forwarded-proto") === "https";

    response.cookies.set({
      name: ADMIN_COOKIE,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error) {
    console.error("Login route error:", error);
    return NextResponse.json({ error: "Sign-in failed. Please try again." }, { status: 500 });
  }
}
