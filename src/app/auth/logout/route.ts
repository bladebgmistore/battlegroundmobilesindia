import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

function signOut(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login?signedout=1", request.url));
  clearSessionCookie(response);
  // Clear legacy cookies too, so no stale admin/customer session survives.
  response.cookies.set({ name: "bgmi_admin_session", value: "", path: "/", maxAge: 0 });
  response.cookies.set({ name: "bgmi_user_session", value: "", path: "/", maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  return signOut(request);
}

export async function POST(request: NextRequest) {
  return signOut(request);
}
