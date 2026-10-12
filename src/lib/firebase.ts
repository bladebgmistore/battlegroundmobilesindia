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
 *   • `firebaseConfig` reads the `NEXT_PUBLIC_FIREBASE_*` variables — these
 *     values are public by design (they ship inside the browser bundle) — and
 *     falls back to the known-good literals below whenever a variable is
 *     missing, empty or malformed.
 *
 * Why the hard-coded fallbacks matter: an unset or mis-typed
 * `NEXT_PUBLIC_FIREBASE_API_KEY` is what produces the classic
 * `auth/api-key-not-valid` failure at `signInWithPhoneNumber()`. Reading the
 * environment first (so a rotated key in the hosting dashboard still wins) and
 * validating the *shape* of the value means a broken deployment can never
 * break phone sign-in again.
 *
 * Note: Next.js only inlines `process.env.NEXT_PUBLIC_*` when the reference is
 * written out literally, which is why every field below spells the variable
 * name in full instead of looping over a map.
 */

import type { Auth, ConfirmationResult, RecaptchaVerifier } from "firebase/auth";

/* ─────────────────────── published Firebase web config ─────────────────────── */

/**
 * Known-good values for the `battlegroundmobileindias-f8e2f` project.
 *
 * A Firebase **web** config is not a secret: it is designed to be public and
 * ships inside the browser bundle (security rules — not the API key — protect
 * the data). Keeping the literals here guarantees phone OTP keeps working when
 * the hosting dashboard is missing or mis-configuring the env variables.
 */
const FIREBASE_FALLBACK = {
  apiKey: "AIzaSyBo2oq92M_Ld6OGIWUWUwVd9q5GnW3oKNY",
  authDomain: "battlegroundmobileindias-f8e2f.firebaseapp.com",
  projectId: "battlegroundmobileindias-f8e2f",
  storageBucket: "battlegroundmobileindias-f8e2f.firebasestorage.app",
  messagingSenderId: "982171987292",
  appId: "1:982171987292:web:4f52d95624d271caa02599",
  measurementId: "G-WKTZZ2KHYH",
} as const;

type ConfigKey = keyof typeof FIREBASE_FALLBACK;

/** `NEXT_PUBLIC_FIREBASE_*` variable that backs each config field. */
const ENV_NAMES: Record<ConfigKey, string> = {
  apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "NEXT_PUBLIC_FIREBASE_APP_ID",
  measurementId: "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID",
};

/**
 * Shape of every value exactly as Firebase issues it.
 *
 * `apiKey` is the important one: Firebase keys are always `AIza` followed by 35
 * URL-safe characters (39 in total). A truncated or duplicated paste — the
 * original bug in this repo produced a 41-character key, which Firebase answers
 * with `auth/api-key-not-valid` — is rejected here and replaced by the fallback
 * instead of ever being sent to Google.
 */
const CONFIG_PATTERNS: Record<ConfigKey, RegExp> = {
  apiKey: /^AIza[0-9A-Za-z_-]{35}$/,
  authDomain: /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i,
  projectId: /^[a-z0-9][a-z0-9-]{2,62}$/,
  storageBucket: /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i,
  messagingSenderId: /^\d{6,20}$/,
  // Firebase app ids look like `1:<messagingSenderId>:web:<hex hash>`.
  appId: /^1:\d{6,20}:web:[0-9a-f]{8,}$/i,
  measurementId: /^G-[A-Z0-9]{4,}$/i,
};

/** Strings dashboards often hold when a variable was never really configured. */
const PLACEHOLDER_VALUES = new Set([
  "undefined",
  "null",
  "none",
  "false",
  "your-api-key",
  "your_api_key",
  "yourapikey",
  "api-key",
  "apikey",
  "changeme",
  "todo",
  "xxx",
]);

/** Env variables that existed but were unusable (they fell back to the literals). */
const invalidEnvNames: string[] = [];

/**
 * Safely read one Firebase config value.
 *
 * Accepts the already-`||`-guarded value and returns
 *   1. the environment value, when it is present **and** well-formed;
 *   2. the direct string fallback, when the variable is undefined, empty,
 *      wrapped in stray quotes, a placeholder (`undefined`, `null`, …) or
 *      malformed for that field (e.g. an API key that is not `AIza…`).
 *
 * Never throws: a broken environment must degrade to a working config, not to
 * a blank screen.
 */
function readConfigValue(raw: string | undefined, key: ConfigKey): string {
  const fallback = FIREBASE_FALLBACK[key];
  let value = "";

  try {
    value = String(raw ?? "")
      .trim()
      // Hosting dashboards often store values as `"AIza…"` — unwrap them.
      .replace(/^["'`]+|["'`]+$/g, "")
      .trim();
  } catch {
    return fallback;
  }

  if (!value) return fallback; // undefined / empty → direct fallback

  if (PLACEHOLDER_VALUES.has(value.toLowerCase()) || !CONFIG_PATTERNS[key].test(value)) {
    // Present but invalid — report it once (helps debug the hosting dashboard
    // without ever logging the value itself) and use the fallback.
    if (!invalidEnvNames.includes(ENV_NAMES[key])) {
      invalidEnvNames.push(ENV_NAMES[key]);
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[firebase] ${ENV_NAMES[key]} is set but does not look like a valid Firebase ${key}; using the built-in default instead.`,
        );
      }
    }
    return fallback;
  }

  return value;
}

export const firebaseConfig = {
  apiKey: readConfigValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBo2oq92M_Ld6OGIWUWUwVd9q5GnW3oKNY", "apiKey"),
  authDomain: readConfigValue(
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "battlegroundmobileindias-f8e2f.firebaseapp.com",
    "authDomain",
  ),
  projectId: readConfigValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "battlegroundmobileindias-f8e2f", "projectId"),
  storageBucket: readConfigValue(
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "battlegroundmobileindias-f8e2f.firebasestorage.app",
    "storageBucket",
  ),
  messagingSenderId: readConfigValue(
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "982171987292",
    "messagingSenderId",
  ),
  appId: readConfigValue(
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:982171987292:web:4f52d95624d271caa02599",
    "appId",
  ),
  measurementId: readConfigValue(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-WKTZZ2KHYH", "measurementId"),
};

/**
 * `true` when the minimum set of Firebase web config values is present.
 * The phone-login card shows a friendly configuration notice when this is
 * `false` instead of throwing inside the click handler.
 */
export const FIREBASE_PHONE_AUTH_ENABLED = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
);

/**
 * Names of `NEXT_PUBLIC_FIREBASE_*` variables that were set but invalid, so the
 * login card can tell support where to look (`/api/auth/config-check` reports
 * the same thing server-side).
 */
export const firebaseEnvIssues: readonly string[] = Object.freeze([...invalidEnvNames]);

/* ───────────────────────────── Auth singleton ───────────────────────────── */

let authInstance: Auth | null = null;
let authPromise: Promise<Auth> | null = null;

/**
 * Initialise (once) and return the shared Firebase Auth instance.
 *
 * `getApps().length` keeps this idempotent: React Fast Refresh, a second import
 * or a client-side navigation must never call `initializeApp()` twice
 * ("Firebase App named '[DEFAULT]' already exists").
 */
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
