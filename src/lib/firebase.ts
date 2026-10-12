"use client";

/**
 * Firebase Web SDK bootstrap — used ONLY for phone (+91) sign-in.
 *
 * Google sign-in keeps using the existing OAuth 2.0 / PKCE flow untouched, so
 * the two methods live side by side and share one signed session cookie.
 *
 * Everything here is lazy + client-only:
 *   • the SDK is imported dynamically, so it never lands in the server bundle
 *     and never breaks SSR or `next build`;
 *   • the app instance is a singleton (safe across HMR and route changes);
 *   • `firebaseConfig` is read from `NEXT_PUBLIC_FIREBASE_*` env variables —
 *     these values are public by design (they ship inside the browser bundle).
 */

import type { Auth, ConfirmationResult, RecaptchaVerifier } from "firebase/auth";

export const firebaseConfig = {
  apiKey: (process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "").trim(),
  authDomain: (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "").trim(),
  projectId: (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "").trim(),
  storageBucket: (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "").trim(),
  messagingSenderId: (process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "").trim(),
  appId: (process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "").trim(),
  measurementId: (process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "").trim(),
};

/**
 * `true` when the minimum set of Firebase web config values is present.
 * The phone-login card shows a friendly configuration notice when this is
 * `false` instead of throwing inside the click handler.
 */
export const FIREBASE_PHONE_AUTH_ENABLED = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
);

let authInstance: Auth | null = null;
let authPromise: Promise<Auth> | null = null;

/** Initialise (once) and return the shared Firebase Auth instance. */
export async function getFirebaseAuth(): Promise<Auth> {
  if (authInstance) return authInstance;
  if (authPromise) return authPromise;

  authPromise = (async () => {
    const { initializeApp, getApp, getApps } = await import("firebase/app");
    const { browserLocalPersistence, getAuth, setPersistence } = await import("firebase/auth");

    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    auth.useDeviceLanguage();

    // Keep the Firebase user id in localStorage so a returning customer is not
    // prompted again on the same device; the store's own httpOnly session
    // cookie remains the only thing that grants access to the site.
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch {
      // Storage blocked (private mode) — in-memory fallback is fine.
    }

    authInstance = auth;
    return auth;
  })();

  try {
    return await authPromise;
  } catch (error) {
    authPromise = null;
    throw error;
  }
}

/**
 * Build the invisible reCAPTCHA verifier bound to `<div id="recaptcha-container">`.
 *
 * Firebase requires exactly one live verifier per container: reuse the
 * instance for "Resend OTP" and call `clearInvisibleRecaptcha()` (or re-create)
 * after every completed / failed attempt.
 */
export async function createInvisibleRecaptcha(containerId = "recaptcha-container"): Promise<RecaptchaVerifier> {
  const auth = await getFirebaseAuth();
  const { RecaptchaVerifier } = await import("firebase/auth");
  return new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
    // The badge is rendered by Google; styling is intentionally left to Google
    // so the widget keeps working if their markup changes.
    badge: "bottomright",
  });
}

export type { Auth, ConfirmationResult, RecaptchaVerifier };
