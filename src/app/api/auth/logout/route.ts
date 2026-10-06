import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** JSON sign-out used by client components (see /auth/logout for the redirect flow). */
export async function POST(_request: NextRequest) {
  const response = NextResponse.json({ ok: true, redirect: "/login?signedout=1" });
  clearSessionCookie(response);
  response.cookies.set({ name: "bgmi_admin_session", value: "", path: "/", maxAge: 0 });
  return response;
}
