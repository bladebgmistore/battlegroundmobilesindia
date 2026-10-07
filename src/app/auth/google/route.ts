import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Legacy Google OAuth entry — now redirects to Clerk sign-in.
 * Clerk handles Google OAuth natively when enabled in dashboard.
 */
export async function GET(request: NextRequest) {
  const rawNext = request.nextUrl.searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";
  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("redirect_url", next);
  return NextResponse.redirect(signInUrl);
}
