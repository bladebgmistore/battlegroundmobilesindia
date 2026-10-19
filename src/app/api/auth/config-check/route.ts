import { NextResponse, type NextRequest } from "next/server";
import {
  getClerkConfig,
  getDatabaseUrl,
  getDirectDatabaseUrl,
  getGoogleOAuthConfig,
  getGoogleRedirectUri,
  getNeonProjectId,
  getNextAuthUrl,
  getOwnerEmails,
  isAuthSecretConfigured,
  isOwnerEmailConfigured,
} from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public configuration diagnostic for the deployed environment.
 *
 * Reports which of the variables Vercel is expected to provide are present
 * (see `.env.example`). It never returns any secret value — only booleans and
 * a masked client-id preview.
 */
export async function GET(request: NextRequest) {
  const google = getGoogleOAuthConfig();
  const clerk = getClerkConfig();
  const authSecretConfigured = isAuthSecretConfigured();
  const ownerEmails = getOwnerEmails();
  const databaseUrl = getDatabaseUrl() ?? "";
  const directDatabaseUrl = getDirectDatabaseUrl() ?? "";
  const nextAuthUrl = getNextAuthUrl();
  const origin = request.nextUrl.origin;
  const effectiveRedirectUri = getGoogleRedirectUri(request.url);

  // Anything in this list blocks sign-in or persistence.
  const missing: string[] = [];
  if (!google.clientId) missing.push("GOOGLE_CLIENT_ID");
  if (!google.clientSecret) missing.push("GOOGLE_CLIENT_SECRET");
  if (!authSecretConfigured) missing.push("AUTH_SECRET");
  if (!databaseUrl) missing.push("BGMISTORE_DATABASE_URL");
  if (!isOwnerEmailConfigured()) missing.push("OWNER_EMAIL");

  return NextResponse.json(
    {
      ready: missing.length === 0,
      missing,
      checks: {
        // Database — BGMISTORE_* keys (Vercel Postgres / Neon integration).
        BGMISTORE_DATABASE_URL: Boolean(databaseUrl),
        BGMISTORE_DATABASE_URL_UNPOOLED: Boolean(directDatabaseUrl),
        BGMISTORE_NEON_PROJECT_ID: Boolean(getNeonProjectId()),
        // Google OAuth 2.0.
        GOOGLE_CLIENT_ID: Boolean(google.clientId),
        GOOGLE_CLIENT_SECRET: Boolean(google.clientSecret),
        GOOGLE_REDIRECT_URI: Boolean(google.redirectUri),
        // Session / site URL.
        AUTH_SECRET: authSecretConfigured,
        NEXTAUTH_URL: Boolean(nextAuthUrl),
        OWNER_EMAIL: isOwnerEmailConfigured(),
        // Clerk (reported for parity — the app signs users in with its own
        // Google OAuth flow, so these keys are optional).
        CLERK_SECRET_KEY: Boolean(clerk.secretKey),
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: Boolean(clerk.publishableKey),
      },
      clerkConfigured: clerk.isConfigured,
      googleConfigured: google.isConfigured,
      databaseConfigured: Boolean(databaseUrl),
      migrationsReady: Boolean(directDatabaseUrl),
      clientIdPreview: google.clientId ? `${google.clientId.slice(0, 12)}…${google.clientId.slice(-24)}` : null,
      ownerEmail: ownerEmails[0] ?? null,
      requestOrigin: origin,
      siteUrl: nextAuthUrl ?? null,
      effectiveRedirectUri,
      hint:
        missing.length === 0
          ? "Configuration looks complete. Ensure effectiveRedirectUri exactly matches an Authorized redirect URI on the Google OAuth client."
          : `Add these environment variables in your hosting dashboard and redeploy: ${missing.join(", ")}`,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
