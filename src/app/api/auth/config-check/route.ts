import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public diagnostic endpoint — tells you which auth environment variables are
 * missing on the server WITHOUT ever exposing their values.
 *
 * Visit https://<your-domain>/api/auth/config-check after deploying.
 * Every flag must be `true` and `redirectUri` must exactly match the
 * "Authorised redirect URI" configured on the Google OAuth client.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "";
  const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  const ownerEmail = process.env.OWNER_EMAIL ?? "";
  const databaseUrl = process.env.DATABASE_URL ?? "";

  const origin = new URL(request.url).origin;
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
      // Safe to show: the public half of the client id and the redirect URI.
      clientIdPreview: clientId ? `${clientId.slice(0, 12)}…${clientId.slice(-24)}` : null,
      ownerEmail: ownerEmail || "manavjeph800@gmail.com (default)",
      requestOrigin: origin,
      effectiveRedirectUri,
      hint:
        missing.length === 0
          ? "All set. Make sure effectiveRedirectUri is listed in Google Cloud Console → Credentials → Authorised redirect URIs."
          : `Add these environment variables in your hosting dashboard and redeploy: ${missing.join(", ")}`,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
