import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Next.js 16 proxy file — replaces the old middleware.ts convention.
 * This file now uses Clerk for compulsory authentication.
 *
 * Old logic: checked custom bgmi_session cookie + OWNER_EMAIL allow-list.
 * New logic: Clerk session — auth.protect() redirects unauthenticated users
 * to /sign-in automatically.
 *
 * Admin area role checks are now done in Server Components / API routes
 * via @/lib/clerk-auth.ts (which checks manavjeph800@gmail.com + staff_members table).
 */

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
