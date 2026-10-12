/**
 * Server-side verification of a Firebase Phone Auth ID token.
 *
 * The browser proves the customer owns the SIM by completing Firebase's OTP
 * challenge; the resulting ID token is then handed to `/api/auth/phone`, which
 * must NOT trust the client. Two independent checks run here:
 *
 *  1. LOCAL JWT CHECKS (always) — signature-independent claim validation:
 *     `aud` === this project, `iss` === securetoken.google.com/<project>,
 *     not expired, not issued in the future, `sub` present and the identity
 *     was created by the `phone` provider.
 *
 *  2. AUTHORITATIVE LOOKUP (production) — the token is posted to Google's
 *     Identity Toolkit `accounts:lookup` endpoint. Only Google can answer
 *     "is this token genuine?", and the answer also returns the verified
 *     `phoneNumber` for the account.
 *
 * Failure policy: if Google cannot be reached (offline sandbox, DNS block),
 * development keeps working on the local checks alone and production fails
 * closed — so a network outage can never become an authentication bypass.
 * Override intentionally with `FIREBASE_PHONE_VERIFY=jwt|strict`.
 *
 * Runtime: Node.js only (uses `fetch` + Buffer-free base64 helpers).
 */

export type FirebasePhoneIdentity = {
  /** Firebase Auth user id (`sub` claim / `localId`) — stable per phone number. */
  uid: string;
  /** Verified E.164 number, e.g. `+919876543210`. */
  phoneNumber: string;
  /** How the token was validated (telemetry / logging only). */
  verification: "identity-toolkit" | "jwt-claims";
};

export type VerifyResult =
  | { ok: true; identity: FirebasePhoneIdentity }
  | { ok: false; error: string; status: number };

/**
 * Public Firebase web values. The direct string fallbacks (identical to
 * `src/lib/firebase.ts`) matter here too: the Identity Toolkit `accounts:lookup`
 * call below authenticates with this key, and an invalid one answers
 * "API key not valid", which would reject every genuine OTP sign-in in
 * production. Keep both files in sync when the key is ever rotated.
 */
const PROJECT_ID = (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "battlegroundmobileindias-f8e2f").trim();
const API_KEY = (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBo2oq92M_Ld6OGIWUWUwVd9q5GnW3oKNY").trim();

/** Firebase web API keys are always `AIza` + 35 URL-safe characters. */
const FIREBASE_API_KEY_PATTERN = /^AIza[0-9A-Za-z_-]{35}$/;

/** Reject a malformed key before it reaches Google (avoids a confusing 400). */
const EFFECTIVE_API_KEY = FIREBASE_API_KEY_PATTERN.test(API_KEY) ? API_KEY : "";

/** `strict` = Google lookup required · `jwt` = claims only · auto by NODE_ENV. */
function verificationMode(): "strict" | "jwt" {
  const configured = (process.env.FIREBASE_PHONE_VERIFY ?? "").trim().toLowerCase();
  if (configured === "strict") return "strict";
  if (configured === "jwt" || configured === "claims") return "jwt";
  return process.env.NODE_ENV === "production" ? "strict" : "jwt";
}

type JwtPayload = {
  aud?: string;
  iss?: string;
  sub?: string;
  exp?: number;
  iat?: number;
  auth_time?: number;
  phone_number?: string;
  firebase?: { sign_in_provider?: string; identities?: Record<string, unknown> };
};

/** Decode the (unsigned) payload of a JWT. Signature checks happen elsewhere. */
function decodePayload(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(json) as JwtPayload;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Validate the claims we can check without Google. Returns the identity when
 * every claim matches this Firebase project, or a reason string otherwise.
 */
function verifyClaims(token: string): { identity: FirebasePhoneIdentity } | { error: string } {
  const payload = decodePayload(token);
  if (!payload) return { error: "This sign-in token could not be read." };

  if (PROJECT_ID && payload.aud !== PROJECT_ID) return { error: "This sign-in token belongs to another project." };
  if (PROJECT_ID && payload.iss && payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) {
    return { error: "This sign-in token was issued by another issuer." };
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= now) return { error: "This sign-in token has expired. Please request a new OTP." };
  if (typeof payload.iat === "number" && payload.iat > now + 300) return { error: "This sign-in token is not valid yet." };

  const uid = typeof payload.sub === "string" ? payload.sub.trim() : "";
  if (!uid) return { error: "This sign-in token has no account id." };

  // Only tokens minted by the PHONE provider may create a phone session —
  // a Google/anonymous/e-mail token must never be silently upgraded.
  // Firebase always stamps `sign_in_provider`, so a missing value is rejected
  // as well (fail closed).
  if (payload.firebase?.sign_in_provider !== "phone") {
    return { error: "This sign-in token was not created by phone verification." };
  }

  const phoneNumber = typeof payload.phone_number === "string" ? payload.phone_number.trim() : "";
  if (!phoneNumber) return { error: "This sign-in token carries no verified mobile number." };

  return { identity: { uid, phoneNumber, verification: "jwt-claims" } };
}

/**
 * Ask Google whether the token is genuine. Returns:
 *   • `{ ok: true, identity }`  → Google confirmed the token + number
 *   • `{ ok: false, rejected: true }` → Google refused it (expired/forged/revoked)
 *   • `{ ok: false, rejected: false }` → Google was unreachable (network error)
 */
async function lookupWithIdentityToolkit(
  token: string,
): Promise<{ ok: true; identity: FirebasePhoneIdentity } | { ok: false; rejected: boolean; error: string }> {
  if (!EFFECTIVE_API_KEY || !PROJECT_ID) {
    return { ok: false, rejected: false, error: "Firebase is not configured on this server." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(EFFECTIVE_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
        signal: controller.signal,
        cache: "no-store",
      },
    );

    const data = (await response.json().catch(() => null)) as
      | { users?: { localId?: string; phoneNumber?: string }[]; error?: { message?: string } }
      | null;

    if (!response.ok) {
      // 400/403 with a Google error body = the token itself was refused.
      const message = data?.error?.message ?? `HTTP ${response.status}`;
      return { ok: false, rejected: response.status < 500, error: message };
    }

    const account = data?.users?.[0];
    if (!account?.localId) return { ok: false, rejected: true, error: "This sign-in token is no longer valid." };

    const phoneNumber = account.phoneNumber?.trim() ?? "";
    if (!phoneNumber) return { ok: false, rejected: true, error: "This account has no verified mobile number." };

    return { ok: true, identity: { uid: account.localId, phoneNumber, verification: "identity-toolkit" } };
  } catch {
    // DNS failure / timeout / sandbox without internet — NOT a token rejection.
    return { ok: false, rejected: false, error: "Could not reach Firebase to verify this sign-in." };
  } finally {
    clearTimeout(timer);
  }
}

/** Full verification pipeline used by `/api/auth/phone`. */
export async function verifyFirebasePhoneToken(idToken: string | null | undefined): Promise<VerifyResult> {
  const token = typeof idToken === "string" ? idToken.trim() : "";
  if (!token) return { ok: false, error: "Missing sign-in token.", status: 400 };
  if (token.length > 4096) return { ok: false, error: "Invalid sign-in token.", status: 400 };

  // Without a project + API key this server cannot know which project a token
  // belongs to, so it must not issue a phone session at all (fail closed).
  if (!PROJECT_ID || !EFFECTIVE_API_KEY) {
    return { ok: false, error: "Phone sign-in is not configured on this server.", status: 503 };
  }

  const claims = verifyClaims(token);
  if ("error" in claims) return { ok: false, error: claims.error, status: 401 };

  const lookup = await lookupWithIdentityToolkit(token);
  if (lookup.ok) {
    // Google's answer wins, but it must agree with the claims on the number.
    const claimed = claims.identity.phoneNumber.replace(/\s/g, "");
    if (claimed !== lookup.identity.phoneNumber.replace(/\s/g, "")) {
      return { ok: false, error: "Sign-in details did not match. Please request a new OTP.", status: 401 };
    }
    return { ok: true, identity: lookup.identity };
  }

  if (lookup.rejected) return { ok: false, error: lookup.error || "This sign-in token is no longer valid.", status: 401 };

  // Google unreachable.
  if (verificationMode() === "jwt") {
    console.warn(`[phone-auth] Identity Toolkit unreachable (${lookup.error}); accepting locally validated claims (non-production).`);
    return { ok: true, identity: claims.identity };
  }

  return { ok: false, error: "Verification service is temporarily unavailable. Please try again.", status: 503 };
}
