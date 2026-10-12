import { NextResponse, type NextRequest } from "next/server";
import { createSession } from "@/lib/auth-session";
import { applySessionCookie, isSecureRequest } from "@/lib/auth";
import { verifyFirebasePhoneToken } from "@/lib/firebase-verify";
import { upsertPhoneUser } from "@/lib/phone-users";
import { toE164India } from "@/lib/phone-number";
import { recordVisit } from "@/lib/site-logs";
import { getClientIp } from "@/lib/geo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/auth/phone — step 2 of the +91 OTP sign-in.
 *
 * The browser completes Firebase's `signInWithPhoneNumber` challenge and posts
 * the resulting ID token here. The token is verified server-side (see
 * `src/lib/firebase-verify.ts`), the local account is created/refreshed, and
 * the SAME signed `bgmi_session` cookie used by Google sign-in is issued — so
 * every existing page, guard and API keeps working with zero changes.
 *
 * Public route: listed in `PUBLIC_API` (src/lib/auth-config.ts) because the
 * customer is, by definition, not signed in yet.
 */

/** Very small in-memory brute-force damper: 12 attempts / IP / 5 minutes. */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 12;

function rateLimited(ip: string | null): boolean {
  if (!ip) return false;
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  if (attempts.size > 5000) attempts.clear(); // memory guard
  return entry.count > MAX_ATTEMPTS;
}

function safeNext(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many sign-in attempts. Please wait a few minutes." }, { status: 429 });
  }

  let body: { idToken?: string; next?: string; name?: string };
  try {
    body = (await request.json()) as { idToken?: string; next?: string; name?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Optional display name typed on the login card (Firebase has no name for
  // phone accounts). Trimmed + length-capped; never required.
  const displayName = typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim().slice(0, 120) : "";

  const verified = await verifyFirebasePhoneToken(body.idToken);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: verified.status });
  }

  const { uid, phoneNumber, verification } = verified.identity;
  const user = await upsertPhoneUser({ uid, phoneNumber, name: displayName || undefined });
  if (!user.isActive) {
    return NextResponse.json({ error: "This account has been disabled by the administrator." }, { status: 403 });
  }

  const token = await createSession({
    id: user.id,
    googleId: "",
    email: user.email ?? "",
    phone: toE164India(phoneNumber),
    name: user.name,
    picture: null,
    role: user.role,
    authProvider: "phone",
  });

  const response = NextResponse.json({
    ok: true,
    redirect: safeNext(body.next),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: toE164India(phoneNumber),
      picture: null,
      role: user.role,
      provider: "phone",
    },
  });

  applySessionCookie(response, token, isSecureRequest(request));

  // Login telemetry (same table the admin panel already reads). Never blocking.
  await recordVisit({
    userId: user.id,
    userEmail: user.email ?? undefined,
    userName: user.name,
    ipAddress: ip ?? undefined,
    pageUrl: `/api/auth/phone (login · ${verification})`,
    userAgent: request.headers.get("user-agent"),
  }).catch(() => undefined);

  return response;
}
