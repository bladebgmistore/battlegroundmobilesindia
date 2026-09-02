import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, getAdminSession } from "@/lib/admin-auth";
import { db } from "@/db";
import { adminSessions } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getAdminSession(request);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, ...session });
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (token) {
    try {
      await db.delete(adminSessions).where(eq(adminSessions.sessionToken, token));
    } catch (e) {
      console.error("Non-blocking DB logout deletion error:", e);
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: ADMIN_COOKIE, value: "", httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
