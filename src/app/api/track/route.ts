import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { recordVisit } from "@/lib/site-logs";
import { getClientIp } from "@/lib/geo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Page-view beacon. The <VisitTracker /> client component posts here on every
 * route change; the IP / user-agent are read server-side so they can't be
 * spoofed by the payload.
 */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { path?: string; referrer?: string };
  const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path : null;
  if (!path) return NextResponse.json({ ok: false, error: "path required" }, { status: 400 });

  // Never block the UI on telemetry.
  const ok = await recordVisit({
    userId: session.id,
    userEmail: session.email,
    userName: session.name,
    ipAddress: getClientIp(request),
    pageUrl: path,
    referrer: body.referrer ?? request.headers.get("referer"),
    userAgent: request.headers.get("user-agent"),
    country: request.headers.get("x-vercel-ip-country"),
    city: request.headers.get("x-vercel-ip-city"),
  }).catch(() => false);

  return NextResponse.json({ ok }, { headers: { "Cache-Control": "no-store" } });
}
