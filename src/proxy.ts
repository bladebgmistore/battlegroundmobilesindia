import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Next.js 16 proxy file — Clerk compulsory authentication.
 * 
 * If Clerk env vars are missing, we skip auth to prevent hard 500
 * and let the layout show a configuration error page.
 */

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/favicon(.*)",
  "/api/health(.*)",
  "/api/auth/config-check(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const hasClerkKeys = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
  );

  // If Clerk not configured, don't block — let layout show config error
  if (!hasClerkKeys) {
    console.warn("Clerk keys missing — skipping auth protect, showing config error page");
    return NextResponse.next();
  }

  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  try {
    await auth.protect();
  } catch (error: any) {
    // If error is a Next.js redirect/not-found fallback, handle it
    if (error?.digest?.startsWith("NEXT_HTTP_ERROR_FALLBACK")) {
      if (error.digest.includes(";404")) {
        const url = req.nextUrl.clone();
        if (!url.pathname.startsWith("/api/")) {
          url.pathname = "/sign-in";
          url.searchParams.set("redirect_url", req.nextUrl.pathname + req.nextUrl.search);
          return NextResponse.redirect(url);
        }
        return NextResponse.json(
          { error: "Authentication required.", login: "/sign-in" },
          { status: 401 }
        );
      }
      throw error;
    }

    console.error("Clerk auth error:", error);
    const url = req.nextUrl.clone();
    if (url.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in.", login: "/sign-in" },
        { status: 401 }
      );
    }
    if (!url.pathname.startsWith("/sign-in") && !url.pathname.startsWith("/sign-up")) {
      url.pathname = "/sign-in";
      url.searchParams.set("redirect_url", req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
