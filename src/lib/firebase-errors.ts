/**
 * Friendly copy for Firebase Phone Auth failures.
 *
 * Firebase throws `FirebaseError` objects carrying a stable `code`
 * (`auth/invalid-verification-code`, …). This module maps those codes to
 * short, human sentences in the store's own words — no SDK jargon reaches the
 * customer, and support staff can still find the original code in the console.
 *
 * Pure + client-safe: no imports, no side effects.
 */

const MESSAGES: Record<string, string> = {
  // ── Number / quota ────────────────────────────────────────────────────
  "auth/invalid-phone-number": "That mobile number looks invalid. Enter a 10-digit Indian number starting with 6, 7, 8 or 9.",
  "auth/missing-phone-number": "Enter your 10-digit mobile number to continue.",
  "auth/quota-exceeded": "Daily SMS limit reached for this number. Please try again later or sign in with Google.",
  "auth/too-many-requests": "Too many attempts on this number. Please wait a few minutes and try again.",

  // ── OTP ───────────────────────────────────────────────────────────────
  "auth/invalid-verification-code": "That OTP is incorrect. Check the 6-digit code and try again.",
  "auth/missing-verification-code": "Enter the 6-digit OTP we sent to your mobile number.",
  "auth/code-expired": "This OTP has expired. Tap “Resend OTP” to get a new one.",
  "auth/session-expired": "The verification session expired. Tap “Resend OTP” to get a new one.",
  "auth/invalid-verification-id": "This verification is no longer valid. Tap “Resend OTP” and try again.",
  "auth/missing-verification-id": "This verification is no longer valid. Tap “Resend OTP” and try again.",

  // ── reCAPTCHA ─────────────────────────────────────────────────────────
  "auth/captcha-check-failed": "reCAPTCHA verification failed. Please retry the sign-in.",
  "auth/invalid-app-credential": "The security check could not be completed. Refresh the page and try again.",
  "auth/missing-app-credential": "The security check could not be completed. Refresh the page and try again.",
  "auth/operation-not-allowed": "Phone sign-in is disabled for this Firebase project. Enable “Phone” under Authentication → Sign-in method.",
  "auth/unauthorized-domain": "This domain is not authorised for phone sign-in yet. Add it under Firebase → Authentication → Settings → Authorised domains.",
  "auth/network-request-failed": "Network problem — check your connection and try again.",
  "auth/user-disabled": "This account has been disabled. Please contact support.",
  "auth/internal-error": "Firebase could not complete the request. Please try again in a moment.",
  "auth/billing-not-enabled": "SMS delivery needs billing enabled on the Firebase project.",
  "auth/operation-not-supported-in-this-environment":
    "Phone sign-in needs a secure (https) origin. Open the site on the live domain, not an insecure preview.",
};

const FALLBACK = "We could not complete phone sign-in right now. Please try again or sign in with Google.";

/** Extract the `code` from anything thrown by the Firebase SDK. */
export function firebaseErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code) return code;
  }
  return "";
}

/** Short customer-facing sentence for a thrown Firebase error. */
export function firebasePhoneAuthMessage(error: unknown): string {
  const code = firebaseErrorCode(error);
  return MESSAGES[code] ?? FALLBACK;
}

/** True when the code means "the OTP itself was wrong / stale". */
export function isOtpMismatch(error: unknown): boolean {
  return /verification-code|code-expired|verification-id|session-expired/.test(firebaseErrorCode(error));
}
