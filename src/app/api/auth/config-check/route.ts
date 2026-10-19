import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Public Google OAuth + multi-DB configuration diagnostic. Never exposes secrets. */
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "";
  const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? "";
  const ownerEmail = process.env.OWNER_EMAIL ?? "";
  const origin = request.nextUrl.origin;
  const effectiveRedirectUri = redirectUri || `${origin}/auth/google/callback`;

  // Multi-DB: primary (BGMISTORE_*) is required, secondary (DATABASE2_*) is optional
  const primaryPooled =
    process.env.BGMISTORE_POSTGRES_PRISMA_URL ??
    process.env.BGMISTORE_POSTGRES_URL ??
    process.env.BGMISTORE_DATABASE_URL ??
    "";
  const primaryUnpooled =
    process.env.BGMISTORE_DATABASE_URL_UNPOOLED ?? process.env.BGMISTORE_POSTGRES_URL_NON_POOLING ?? "";
  const secondaryPooled =
    process.env.DATABASE2_POSTGRES_PRISMA_URL ??
    process.env.DATABASE2_POSTGRES_URL ??
    process.env.DATABASE2_DATABASE_URL ??
    "";
  const secondaryUnpooled =
    process.env.DATABASE2_DATABASE_URL_UNPOOLED ??
    process.env.DATABASE2_POSTGRES_URL_NON_POOLING ??
    "";
  // Legacy fallback still honoured
  const legacyUrl = process.env.DATABASE_URL ?? "";
  const hasPrimary = Boolean(primaryPooled || primaryUnpooled || legacyUrl);
  const hasSecondary = Boolean(secondaryPooled || secondaryUnpooled);

  const missing: string[] = [];
  if (!clientId) missing.push("GOOGLE_CLIENT_ID");
  if (!clientSecret) missing.push("GOOGLE_CLIENT_SECRET");
  if (!authSecret) missing.push("AUTH_SECRET");
  if (!hasPrimary) missing.push("BGMISTORE_DATABASE_URL / BGMISTORE_POSTGRES_PRISMA_URL (or DATABASE_URL fallback)");

  return NextResponse.json(
    {
      ready: missing.length === 0,
      missing,
      checks: {
        GOOGLE_CLIENT_ID: Boolean(clientId),
        GOOGLE_CLIENT_SECRET: Boolean(clientSecret),
        GOOGLE_REDIRECT_URI: Boolean(redirectUri),
        AUTH_SECRET: Boolean(authSecret),
        OWNER_EMAIL: Boolean(ownerEmail),
        // Multi-DB checks
        PRIMARY_DATABASE: hasPrimary,
        SECONDARY_DATABASE: hasSecondary,
        DATABASE_URL_LEGACY: Boolean(legacyUrl),
        BGMISTORE_DATABASE_URL: Boolean(process.env.BGMISTORE_DATABASE_URL),
        BGMISTORE_DATABASE_URL_UNPOOLED: Boolean(process.env.BGMISTORE_DATABASE_URL_UNPOOLED),
        BGMISTORE_POSTGRES_URL: Boolean(process.env.BGMISTORE_POSTGRES_URL),
        BGMISTORE_POSTGRES_PRISMA_URL: Boolean(process.env.BGMISTORE_POSTGRES_PRISMA_URL),
        BGMISTORE_POSTGRES_URL_NON_POOLING: Boolean(process.env.BGMISTORE_POSTGRES_URL_NON_POOLING),
        DATABASE2_DATABASE_URL: Boolean(process.env.DATABASE2_DATABASE_URL),
        DATABASE2_DATABASE_URL_UNPOOLED: Boolean(process.env.DATABASE2_DATABASE_URL_UNPOOLED),
        DATABASE2_POSTGRES_URL: Boolean(process.env.DATABASE2_POSTGRES_URL),
        DATABASE2_POSTGRES_PRISMA_URL: Boolean(process.env.DATABASE2_POSTGRES_PRISMA_URL),
        DATABASE2_POSTGRES_URL_NON_POOLING: Boolean(process.env.DATABASE2_POSTGRES_URL_NON_POOLING),
      },
      database: {
        primary: {
          pooled: Boolean(primaryPooled),
          unpooled: Boolean(primaryUnpooled),
          viaLegacyFallback: !primaryPooled && !primaryUnpooled && Boolean(legacyUrl),
        },
        secondary: {
          configured: hasSecondary,
          pooled: Boolean(secondaryPooled),
          unpooled: Boolean(secondaryUnpooled),
        },
        failover: hasPrimary && hasSecondary ? "enabled (primary BGMISTORE_* → secondary DATABASE2_*)" : hasPrimary ? "single DB (no failover)" : "not configured",
      },
      clientIdPreview: clientId ? `${clientId.slice(0, 12)}…${clientId.slice(-24)}` : null,
      ownerEmail: ownerEmail || "manavjeph800@gmail.com (default)",
      requestOrigin: origin,
      effectiveRedirectUri,
      hint:
        missing.length === 0
          ? "Google OAuth + database are ready. Ensure effectiveRedirectUri exactly matches an Authorized redirect URI on the Google OAuth client."
          : `Add these environment variables in your hosting dashboard and redeploy: ${missing.join(", ")}`,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
