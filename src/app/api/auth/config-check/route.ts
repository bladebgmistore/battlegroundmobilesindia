import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Public Google OAuth configuration diagnostic. Never exposes the client secret. */
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "";
  const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? "";
  const ownerEmail = process.env.OWNER_EMAIL ?? "";
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const origin = request.nextUrl.origin;
  const effectiveRedirectUri = redirectUri || `${origin}/auth/google/callback`;

  const missing: string[] = [];
  if (!clientId) missing.push("GOOGLE_CLIENT_ID");
  if (!clientSecret) missing.push("GOOGLE_CLIENT_SECRET");
  if (!authSecret) missing.push("AUTH_SECRET");
  if (!databaseUrl) missing.push("DATABASE_URL");

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
        DATABASE_URL: Boolean(databaseUrl),
      },
      clientIdPreview: clientId ? `${clientId.slice(0, 12)}…${clientId.slice(-24)}` : null,
      ownerEmail: ownerEmail || "manavjeph800@gmail.com (default)",
      requestOrigin: origin,
      effectiveRedirectUri,
      hint:
        missing.length === 0
          ? "Google OAuth is ready. Ensure effectiveRedirectUri exactly matches an Authorized redirect URI on the Google OAuth client."
          : `Add these environment variables in your hosting dashboard and redeploy: ${missing.join(", ")}`,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
