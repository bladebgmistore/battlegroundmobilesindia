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

  // Firebase Phone Auth (+91 mobile OTP) — see src/lib/firebase.ts.
  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";
  const firebaseAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "";
  const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";
  const firebaseAppId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "";
  const phoneSignatureCheck = (process.env.FIREBASE_PHONE_VERIFY ?? "").trim().toLowerCase();
  const phoneVerificationMode =
    phoneSignatureCheck === "jwt" || phoneSignatureCheck === "claims"
      ? "jwt-claims (dev convenience — do NOT use in production)"
      : phoneSignatureCheck === "strict" || process.env.NODE_ENV === "production"
        ? "identity-toolkit (strict)"
        : "jwt-claims (dev default)";
  const phoneAuthConfigured = Boolean(firebaseApiKey && firebaseAuthDomain && firebaseProjectId && firebaseAppId);

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
        NEXT_PUBLIC_FIREBASE_API_KEY: Boolean(firebaseApiKey),
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: Boolean(firebaseAuthDomain),
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: Boolean(firebaseProjectId),
        NEXT_PUBLIC_FIREBASE_APP_ID: Boolean(firebaseAppId),
        phoneSignInConfigured: phoneAuthConfigured,
        phoneTokenVerification: phoneVerificationMode,
      },
      // Safe to show: the public half of the client id and the redirect URI.
      clientIdPreview: clientId ? `${clientId.slice(0, 12)}…${clientId.slice(-24)}` : null,
      ownerEmail: ownerEmail || "manavjeph800@gmail.com (default)",
      requestOrigin: origin,
      effectiveRedirectUri,
      /** +91 mobile OTP checklist. */
      phoneAuth: {
        envConfigured: phoneAuthConfigured,
        tokenVerification: phoneVerificationMode,
        hint: phoneAuthConfigured
          ? `Add this origin to Firebase → Authentication → Settings → Authorised domains (currently ${origin}) or phone sign-in will be refused with auth/unauthorized-domain. Also enable the Phone provider under Authentication → Sign-in method.`
          : "Add the NEXT_PUBLIC_FIREBASE_* variables (see .env.example) and redeploy to switch mobile OTP on.",
      },
      hint:
        missing.length === 0
          ? "All set. Make sure effectiveRedirectUri is listed in Google Cloud Console → Credentials → Authorised redirect URIs."
          : `Add these environment variables in your hosting dashboard and redeploy: ${missing.join(", ")}`,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
