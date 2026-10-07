import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Clerk authentication — public browsing, login required at checkout.
 * 
 * Requirement update from user:
 * - Website should open without login (homepage public)
 * - User can browse accounts, UC, categories without login
 * - Login optional from homepage (header shows LOGIN button)
 * - When user clicks BUY / CHECKOUT, then login is required
 * 
 * So we make most storefront routes public, and protect only:
 * - /checkout, /payment, /verify, /account, /dashboard, /admin
 * - /api/orders (POST requires auth), /api/account/*, /api/admin/*
 */

const isPublicRoute = createRouteMatcher([
  // Auth pages themselves
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Public storefront — browsing without login
  "/",
  "/accounts(.*)",
  "/category(.*)",
  "/uc-purchase(.*)",
  "/how-to-buy(.*)",
  "/contact(.*)",
  "/terms(.*)",
  "/refund-policy(.*)",
  // Public APIs needed for homepage to render
  "/api/store(.*)",
  "/api/feedbacks(.*)",
  "/api/favicon(.*)",
  "/api/health(.*)",
  "/api/track(.*)",
  "/api/contact(.*)",
  "/api/coupons/validate(.*)",
  "/api/bgmi/verify-uid(.*)",
  "/api/webhooks(.*)",
  // Legacy login routes (redirect to sign-in)
  "/login(.*)",
  "/auth(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const hasClerkKeys = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
  );

  if (!hasClerkKeys) {
    return NextResponse.next();
  }

  // Public routes — no auth check, allow guest browsing
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Protected routes — require login (checkout, account, dashboard, admin, payment, verify)
  try {
    await auth.protect();
  } catch (error: any) {
    if (error?.digest?.startsWith("NEXT_HTTP_ERROR_FALLBACK")) {
      if (error.digest.includes(";404")) {
        const url = req.nextUrl.clone();
        if (url.pathname.startsWith("/api/")) {
          return NextResponse.json(
            { error: "Please sign in to continue. Login required at checkout.", login: "/sign-in" },
            { status: 401 }
          );
        }
        // For pages like /checkout, /account, /dashboard, /admin → redirect to sign-in
        url.pathname = "/sign-in";
        url.searchParams.set("redirect_url", req.nextUrl.pathname + req.nextUrl.search);
        return NextResponse.redirect(url);
      }
      throw error;
    }

    console.error("Clerk auth error:", error);
    const url = req.nextUrl.clone();
    if (url.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required. Login required at checkout.", login: "/sign-in" },
        { status: 401 }
      );
    }
    url.pathname = "/sign-in";
    url.searchParams.set("redirect_url", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
