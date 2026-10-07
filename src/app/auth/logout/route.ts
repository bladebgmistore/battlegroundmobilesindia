import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

/**
 * Legacy logout route — now redirects to Clerk sign-in.
 * Clerk's <SignOutButton> handles actual sign-out, but this keeps
 * old /auth/logout links working.
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (userId) {
      // If still signed in via Clerk, redirect to sign-in which will show signed-in state
      // Clerk's middleware will handle sign-out via its own endpoint
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
  } catch {}
  return NextResponse.redirect(new URL("/sign-in", request.url));
}

export async function POST(request: NextRequest) {
  return GET(request);
}
