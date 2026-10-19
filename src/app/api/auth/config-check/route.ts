import { NextResponse, type NextRequest } from "next/server";
import {
  getClerkConfig,
  getDatabaseUrlDb1,
  getDatabaseUrlDb2,
  getDatabaseUrlDb3,
  getGoogleOAuthConfig,
  getGoogleRedirectUri,
  getNeonProjectId,
  getNextAuthUrl,
  getOwnerEmails,
  getRawNextAuthUrl,
  isAbsoluteHttpUrl,
  isAuthSecretConfigured,
  isOwnerEmailConfigured,
} from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const google = getGoogleOAuthConfig();
  const clerk = getClerkConfig();
  const authSecretConfigured = isAuthSecretConfigured();
  const ownerEmails = getOwnerEmails();
  const databaseUrlDb1 = getDatabaseUrlDb1() ?? "";
  const databaseUrlDb2 = getDatabaseUrlDb2() ?? "";
  const databaseUrlDb3 = getDatabaseUrlDb3() ?? "";
  const nextAuthUrl = getNextAuthUrl();
  const rawNextAuthUrl = getRawNextAuthUrl();
  const origin = request.nextUrl.origin;
  const effectiveRedirectUri = getGoogleRedirectUri(request.url);

  const missing: string[] = [];
  if (!google.clientId) missing.push("GOOGLE_CLIENT_ID");
  if (!google.clientSecret) missing.push("GOOGLE_CLIENT_SECRET");
  if (!authSecretConfigured) missing.push("AUTH_SECRET");
  if (!databaseUrlDb1) missing.push("DATABASE_URL_DB1");
  if (!databaseUrlDb2) missing.push("DATABASE_URL_DB2");
  if (!databaseUrlDb3) missing.push("DATABASE_URL_DB3");
  if (!isOwnerEmailConfigured()) missing.push("OWNER_EMAIL");

  const warnings: string[] = [];

  if (rawNextAuthUrl && !nextAuthUrl) {
    warnings.push(
      `NEXTAUTH_URL is set but is not a valid absolute URL (got ${JSON.stringify(rawNextAuthUrl)}). Fix it to a plain value like "https://your-domain.com" — no brackets, no Markdown, no trailing slash.`,
    );
  }

  if (google.redirectUri && isAbsoluteHttpUrl(google.redirectUri) && process.env.VERCEL_ENV === "production") {
    try {
      const redirectHost = new URL(google.redirectUri).hostname;
      const requestHost = new URL(origin).hostname;
      if (redirectHost !== requestHost) {
        warnings.push(
          `You are serving from ${requestHost} but GOOGLE_REDIRECT_URI points at ${redirectHost}. The OAuth state cookie is host-only, so Google sign-in will fail with "?error=state". Pick ONE canonical host, redirect the other to it, and register that host's callback in Google Cloud Console.`,
        );
      }
    } catch {}
  }

  if (!getNeonProjectId()) {
    warnings.push("BGMISTORE_NEON_PROJECT_ID is not set (diagnostics only — no effect on the app).");
  }

  return NextResponse.json(
    {
      ready: missing.length === 0,
      missing,
      warnings,
      checks: {
        DATABASE_URL_DB1: Boolean(databaseUrlDb1),
        DATABASE_URL_DB2: Boolean(databaseUrlDb2),
        DATABASE_URL_DB3: Boolean(databaseUrlDb3),
        BGMISTORE_NEON_PROJECT_ID: Boolean(getNeonProjectId()),
        GOOGLE_CLIENT_ID: Boolean(google.clientId),
        GOOGLE_CLIENT_SECRET: Boolean(google.clientSecret),
        GOOGLE_REDIRECT_URI: Boolean(google.redirectUri),
        AUTH_SECRET: authSecretConfigured,
        NEXTAUTH_URL: Boolean(nextAuthUrl),
        OWNER_EMAIL: isOwnerEmailConfigured(),
        CLERK_SECRET_KEY: Boolean(clerk.secretKey),
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: Boolean(clerk.publishableKey),
      },
      clerkConfigured: clerk.isConfigured,
      googleConfigured: google.isConfigured,
      databaseConfigured: Boolean(databaseUrlDb1 && databaseUrlDb2 && databaseUrlDb3),
      databases: {
        db1: Boolean(databaseUrlDb1),
        db2: Boolean(databaseUrlDb2),
        db3: Boolean(databaseUrlDb3),
      },
      migrationsReady: Boolean(databaseUrlDb1),
      clientIdPreview: google.clientId ? `${google.clientId.slice(0, 12)}…${google.clientId.slice(-24)}` : null,
      ownerEmail: ownerEmails[0] ?? null,
      requestOrigin: origin,
      siteUrl: nextAuthUrl ?? null,
      effectiveRedirectUri,
      hint:
        missing.length === 0
          ? warnings.length === 0
            ? "Configuration looks complete. Ensure effectiveRedirectUri exactly matches an Authorized redirect URI on the Google OAuth client."
            : `Configuration is usable, but ${warnings.length} warning(s) need attention — see the warnings array.`
          : `Add these environment variables in your hosting dashboard and redeploy: ${missing.join(", ")}`,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
