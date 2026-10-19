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
  getRawNextAuthUrl,
  isAbsoluteHttpUrl,
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
 *
 * `missing` = things that break the app outright.
 * `warnings` = things that are configured but wrong, or absent-but-optional —
 *              these do NOT flip `ready` to false, but each one is a real
 *              defect that is hard to spot from the outside.
 */
export async function GET(request: NextRequest) {
  const google = getGoogleOAuthConfig();
  const clerk = getClerkConfig();
  const authSecretConfigured = isAuthSecretConfigured();
  const ownerEmails = getOwnerEmails();
  const databaseUrl = getDatabaseUrl() ?? "";
  const directDatabaseUrl = getDirectDatabaseUrl() ?? "";
  const nextAuthUrl = getNextAuthUrl();
  const rawNextAuthUrl = getRawNextAuthUrl();
  const origin = request.nextUrl.origin;
  const effectiveRedirectUri = getGoogleRedirectUri(request.url);

  // Anything in this list blocks sign-in or persistence.
  const missing: string[] = [];
  if (!google.clientId) missing.push("GOOGLE_CLIENT_ID");
  if (!google.clientSecret) missing.push("GOOGLE_CLIENT_SECRET");
  if (!authSecretConfigured) missing.push("AUTH_SECRET");
  if (!databaseUrl) missing.push("BGMISTORE_DATABASE_URL");
  if (!isOwnerEmailConfigured()) missing.push("OWNER_EMAIL");

  const warnings: string[] = [];

  // ── Migrations ────────────────────────────────────────────────────────────
  // drizzle.config.ts falls back to the pooled URL, but PgBouncer in
  // transaction mode cannot reliably run DDL, so `drizzle-kit push` may fail.
  if (!directDatabaseUrl) {
    warnings.push(
      "BGMISTORE_DATABASE_URL_UNPOOLED is not set. The app works, but `npx drizzle-kit push` will fall back to the pooled URL, which cannot reliably run CREATE/ALTER TABLE behind PgBouncer. Add the direct (non-pooled) connection string.",
    );
  }

  // ── NEXTAUTH_URL validity ─────────────────────────────────────────────────
  if (rawNextAuthUrl && !nextAuthUrl) {
    warnings.push(
      `NEXTAUTH_URL is set but is not a valid absolute URL (got ${JSON.stringify(rawNextAuthUrl)}). Fix it to a plain value like "https://your-domain.com" — no brackets, no Markdown, no trailing slash.`,
    );
  }

  // ── OAuth redirect host vs. the host actually serving ─────────────────────
  // The OAuth state cookie is host-only, so a browser that began the flow on
  // one host never sends it to the callback on another (classic www vs. apex
  // split). Preview deployments are exempt: pointing GOOGLE_REDIRECT_URI at
  // production from a preview host is intentional.
  if (google.redirectUri && isAbsoluteHttpUrl(google.redirectUri) && process.env.VERCEL_ENV === "production") {
    try {
      const redirectHost = new URL(google.redirectUri).hostname;
      const requestHost = new URL(origin).hostname;
      if (redirectHost !== requestHost) {
        warnings.push(
          `You are serving from ${requestHost} but GOOGLE_REDIRECT_URI points at ${redirectHost}. The OAuth state cookie is host-only, so Google sign-in will fail with "?error=state". Pick ONE canonical host, redirect the other to it, and register that host's callback in Google Cloud Console.`,
        );
      }
    } catch {
      /* unparseable origin — nothing useful to compare */
    }
  }

  // ── Optional keys ─────────────────────────────────────────────────────────
  if (!getNeonProjectId()) {
    warnings.push("BGMISTORE_NEON_PROJECT_ID is not set (diagnostics only — no effect on the app).");
  }

  return NextResponse.json(
    {
      ready: missing.length === 0,
      missing,
      warnings,
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
          ? warnings.length === 0
            ? "Configuration looks complete. Ensure effectiveRedirectUri exactly matches an Authorized redirect URI on the Google OAuth client."
            : `Configuration is usable, but ${warnings.length} warning(s) need attention — see the warnings array.`
          : `Add these environment variables in your hosting dashboard and redeploy: ${missing.join(", ")}`,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
