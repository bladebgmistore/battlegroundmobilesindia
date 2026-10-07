import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Diagnostic endpoint — checks Clerk and DB env vars without exposing values.
 * Visit /api/auth/config-check after deploying.
 */
export async function GET(request: NextRequest) {
  const clerkPub = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const clerkSecret = process.env.CLERK_SECRET_KEY ?? "";
  const ownerEmail = process.env.OWNER_EMAIL ?? "";
  const databaseUrl = process.env.DATABASE_URL ?? "";

  const origin = new URL(request.url).origin;

  const checks = {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: Boolean(clerkPub),
    CLERK_SECRET_KEY: Boolean(clerkSecret),
    OWNER_EMAIL: Boolean(ownerEmail),
    DATABASE_URL: Boolean(databaseUrl),
    GOOGLE_CLIENT_ID: Boolean(process.env.GOOGLE_CLIENT_ID),
    GOOGLE_CLIENT_SECRET: Boolean(process.env.GOOGLE_CLIENT_SECRET),
  };

  const missing = Object.entries(checks)
    .filter(([key, present]) => !present && ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "DATABASE_URL"].includes(key))
    .map(([key]) => key);

  let customDomain: string | null = null;
  try {
    if (clerkPub.startsWith("pk_")) {
      const b64 = clerkPub.split("_").slice(2).join("_");
      const decoded = Buffer.from(b64, "base64").toString("utf-8");
      customDomain = decoded;
    }
  } catch {}

  return NextResponse.json(
    {
      ready: missing.length === 0,
      missing,
      checks,
      clerk: {
        publishableKeyPreview: clerkPub ? `${clerkPub.slice(0, 20)}...${clerkPub.slice(-10)}` : null,
        customDomain,
        secretKeyPreview: clerkSecret ? `${clerkSecret.slice(0, 10)}...${clerkSecret.slice(-5)}` : null,
      },
      ownerEmail: ownerEmail || "manavjeph800@gmail.com (default)",
      requestOrigin: origin,
      hint:
        missing.length === 0
          ? customDomain && customDomain.includes("clerk.")
            ? `Clerk custom domain detected: ${customDomain}. Ensure DNS CNAME is set: ${customDomain} -> frontend-api.clerk.dev (or as per Clerk dashboard). If DNS not set, site will show blank sign-in because clerk-js cannot load. Fix: either set DNS or use standard Clerk keys without custom domain.`
            : "All Clerk env vars present. Ensure login methods (Google, Email OTP, Phone OTP) are enabled in Clerk Dashboard -> User & Authentication."
          : `Add missing env vars in Vercel dashboard and redeploy: ${missing.join(", ")}`,
      compulsoryAuth: {
        enabled: true,
        description: "All routes protected via src/proxy.ts -> auth.protect(). Unauthenticated users redirect to /sign-in.",
        publicRoutes: ["/sign-in(.*)", "/sign-up(.*)", "/api/webhooks(.*)", "/api/favicon(.*)", "/api/health(.*)", "/api/auth/config-check(.*)"],
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
