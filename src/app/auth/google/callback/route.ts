import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Legacy Google OAuth callback — now redirects to Clerk sign-in.
 * All Google auth is handled by Clerk now.
 */
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/sign-in", request.url));
}
