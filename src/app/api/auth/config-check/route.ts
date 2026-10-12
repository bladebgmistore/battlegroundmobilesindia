import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Firebase web-config validation — mirrors `src/lib/firebase.ts`.
 *
 * That module is a client module, so it cannot be imported here; the shape
 * checks are duplicated on purpose. None of this is secret: the very same web
 * config ships inside the browser bundle by design.
 */
const FIREBASE_KEY_PATTERN = /^AIza[0-9A-Za-z_-]{35}$/;
const FIREBASE_DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

/**
 * Public diagnostic endpoint — tells you which auth environment variables are
 * missing OR MALFORMED on the server WITHOUT ever exposing their values.
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

  /**
   * The client validates each value and falls back to the built-in default when
   * it is missing/invalid, so a mis-typed variable can no longer break phone
   * sign-in with `auth/api-key-not-valid` — it only shows up here as a warning.
   */
  const firebaseKeyEnvValid = FIREBASE_KEY_PATTERN.test(firebaseApiKey.trim());
  const firebaseDomainEnvValid = FIREBASE_DOMAIN_PATTERN.test(firebaseAuthDomain.trim());
  const firebaseEnvWarnings = [
    firebaseApiKey && !firebaseKeyEnvValid ? "NEXT_PUBLIC_FIREBASE_API_KEY" : "",
    firebaseAuthDomain && !firebaseDomainEnvValid ? "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" : "",
  ].filter(Boolean);

  const phoneSignatureCheck = (process.env.FIREBASE_PHONE_VERIFY ?? "").trim().toLowerCase();
  const phoneVerificationMode =
    phoneSignatureCheck === "jwt" || phoneSignatureCheck === "claims"
      ? "jwt-claims (dev convenience — do NOT use in production)"
      : phoneSignatureCheck === "strict" || process.env.NODE_ENV === "production"
        ? "identity-toolkit (strict)"
        : "jwt-claims (dev default)";
  /** The dashboard is fully configured (no fallbacks needed). */
  const firebaseEnvComplete = Boolean(
    firebaseApiKey.trim() && firebaseAuthDomain.trim() && firebaseProjectId.trim() && firebaseAppId.trim(),
  );
  /**
   * The browser ALWAYS receives a complete config: each value is env → validated
   * → built-in default for the `battlegroundmobileindias-f8e2f` project. Phone
   * sign-in therefore works even on a dashboard with no Firebase variables.
   */
  const phoneAuthConfigured = true;

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
        /** `false` means the variable is set but malformed (it is ignored). */
        firebaseApiKeyShapeValid: firebaseKeyEnvValid,
        firebaseAuthDomainShapeValid: firebaseDomainEnvValid,
        phoneSignInConfigured: phoneAuthConfigured,
        phoneTokenVerification: phoneVerificationMode,
      },
      /** Firebase web config diagnosis — never prints the values themselves. */
      firebaseConfig: {
        invalidEnvVariables: firebaseEnvWarnings,
        apiKeySource: firebaseKeyEnvValid ? "NEXT_PUBLIC_FIREBASE_API_KEY" : "built-in default (battlegroundmobileindias-f8e2f)",
        hint:
          firebaseEnvWarnings.length > 0
            ? `Fix or delete ${firebaseEnvWarnings.join(", ")} in your hosting dashboard and redeploy — until then the built-in Firebase defaults are used. A malformed NEXT_PUBLIC_FIREBASE_API_KEY is what causes auth/api-key-not-valid.`
            : "Firebase web config looks good. auth/api-key-not-valid can no longer occur: the client validates the variable and falls back to the built-in key.",
      },
      // Safe to show: the public half of the client id and the redirect URI.
      clientIdPreview: clientId ? `${clientId.slice(0, 12)}…${clientId.slice(-24)}` : null,
      ownerEmail: ownerEmail || "manavjeph800@gmail.com (default)",
      requestOrigin: origin,
      effectiveRedirectUri,
      /** +91 mobile OTP checklist. */
      phoneAuth: {
        /** True when the hosting dashboard supplies the values itself. */
        envConfigured: firebaseEnvComplete,
        /** The browser is configured either way — defaults fill any gap. */
        configuredInBrowser: phoneAuthConfigured,
        tokenVerification: phoneVerificationMode,
        hint: `Add this origin to Firebase → Authentication → Settings → Authorised domains (currently ${origin}) or phone sign-in will be refused with auth/unauthorized-domain. Also enable the Phone provider under Authentication → Sign-in method.${
          firebaseEnvComplete ? "" : " The NEXT_PUBLIC_FIREBASE_* variables are not set here — the built-in defaults are being used, which is fine."
        }`,
      },
      hint:
        missing.length === 0
          ? "All set. Make sure effectiveRedirectUri is listed in Google Cloud Console → Credentials → Authorised redirect URIs."
          : `Add these environment variables in your hosting dashboard and redeploy: ${missing.join(", ")}`,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
