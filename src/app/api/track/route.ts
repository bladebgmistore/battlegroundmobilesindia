import { NextResponse, type NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { recordVisit } from "@/lib/site-logs";
import { getClientIp } from "@/lib/geo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Page-view beacon — now powered by Clerk.
 * The <VisitTracker /> client component posts here on every route change.
 * IP / user-agent are read server-side so they can't be spoofed.
 * 
 * Logs: email, IP, URL, timestamp into site_logs table for admin panel.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { path?: string; referrer?: string };
  const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path : null;
  if (!path) return NextResponse.json({ ok: false, error: "path required" }, { status: 400 });

  let userId: string | null = null;
  let userEmail: string | null = null;
  let userName: string | null = "Guest";

  try {
    const { userId: clerkUserId } = await auth();
    if (clerkUserId) {
      const user = await currentUser();
      if (user) {
        const primaryEmail =
          user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ||
          user.emailAddresses[0]?.emailAddress ||
          null;
        userId = clerkUserId;
        userEmail = primaryEmail?.toLowerCase() ?? null;
        userName =
          user.fullName ||
          `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
          primaryEmail?.split("@")[0] ||
          "User";
      }
    }
  } catch {
    // If Clerk is not configured or user is guest, log as guest
  }

  // Never block the UI on telemetry.
  const ok = await recordVisit({
    userId: userId && /^[0-9a-f-]{36}$/i.test(userId) ? userId : null, // site_logs expects uuid or null, but clerk id is string - store null for id, email for identity
    userEmail: userEmail,
    userName: userName,
    ipAddress: getClientIp(request),
    pageUrl: path,
    referrer: body.referrer ?? request.headers.get("referer"),
    userAgent: request.headers.get("user-agent"),
    country: request.headers.get("x-vercel-ip-country"),
    city: request.headers.get("x-vercel-ip-city"),
  }).catch(() => false);

  // Also try with raw clerk id as email fallback for logging if uuid check failed
  if (!ok && userEmail) {
    await recordVisit({
      userId: null,
      userEmail,
      userName,
      ipAddress: getClientIp(request),
      pageUrl: path,
      referrer: body.referrer ?? request.headers.get("referer"),
      userAgent: request.headers.get("user-agent"),
      country: request.headers.get("x-vercel-ip-country"),
      city: request.headers.get("x-vercel-ip-city"),
    }).catch(() => false);
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
