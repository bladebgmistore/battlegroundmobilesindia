# Mobile Number OTP Sign-In (+91) — Firebase Phone Auth

The store now offers **two** sign-in methods that share one session system:

| Method | Flow | Where |
|---|---|---|
| **Google** (unchanged) | OAuth 2.0 Authorization Code + PKCE, server-side exchange | `src/app/auth/google/*`, `src/components/google-login.tsx` |
| **Mobile OTP (+91)** | Firebase Phone Auth → ID token → verified server-side → session cookie | `src/components/phone-login.tsx`, `src/app/api/auth/phone/route.ts` |

Both end with the same signed, `httpOnly`, 30-day `bgmi_session` cookie, so every
existing page, guard (`src/proxy.ts`), API route and admin panel keeps working
with no changes.

---

## 1. Environment variables

Add these to `.env.local` (local) and to your host's environment settings
(Vercel → Settings → Environment Variables, Netlify → Site configuration), then
redeploy. They are already listed in `.env.example`:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBo2oq92M_Ld6OGIWUWUwVd9q5GnW3oKNY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=battlegroundmobileindias-f8e2f.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=battlegroundmobileindias-f8e2f
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=battlegroundmobileindias-f8e2f.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=982171987292
NEXT_PUBLIC_FIREBASE_APP_ID=1:982171987292:web:4f52d95624d271caa02599
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-WKTZZ2KHYH
```

These are **public by design** (they ship inside the browser bundle, exactly like
the Meta Pixel ID). They are *not* secrets — Firebase security comes from the
server-side token verification, not from hiding the API key.

### Optional — the app works without them

`src/lib/firebase.ts` (browser) and `src/lib/firebase-verify.ts` (server) each
hold the known-good values above as **direct string fallbacks**:

```ts
apiKey: readConfigValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBo2oq92M_Ld6OGIWUWUwVd9q5GnW3oKNY", "apiKey"),
```

So a hosting dashboard that is missing the variables — or holding a mistyped one
— can no longer break phone sign-in. Every value is validated against the shape
Firebase issues (`apiKey` must be `AIza` + 35 URL-safe characters, i.e. 39 in
total) and replaced by the built-in default when it fails. Variables are only
needed if the key is rotated or a different Firebase project is used.

Check what the deployment is actually using at **`/api/auth/config-check`**:

```json
{
  "firebaseConfig": {
    "invalidEnvVariables": [],
    "apiKeySource": "built-in default (battlegroundmobileindias-f8e2f)"
  }
}
```

### `auth/api-key-not-valid` — fixed

The original failure came from a **41-character** API key (`…OGIWUWUWUw…`)
instead of the real 39-character one (`…OGIWUWUw…`), so Firebase rejected every
`signInWithPhoneNumber` call. Two independent guards now prevent a repeat:

1. the values in this repo are the correct ones (browser **and** server), and
2. any env value that does not look like a Firebase key is ignored, logged in
   development, listed on the login card and reported by `/api/auth/config-check`.

---

## 2. Firebase Console — one-time setup

1. **Enable the provider**
   Firebase Console → **Authentication** → **Sign-in method** → enable **Phone**.
2. **Authorise your domains**  ← the #1 cause of "it doesn't work"
   Authentication → **Settings** → **Authorised domains** → add **every** host the
   store is served from:
   - your production domain (e.g. `battlegroundmobilesindia.shop`)
   - `*.vercel.app` / `*.netlify.app` preview domains you use
   - `localhost` (already present by default)
   Without this, Firebase rejects the request with
   `auth/unauthorized-domain` (the login card shows a friendly message).
3. **(Optional) Test phone numbers**
   Authentication → Sign-in method → Phone → *Phone numbers for testing*.
   A test number + fixed code lets you QA the flow without burning SMS quota.
4. **(Optional) SMS language**
   Authentication → **Templates** → SMS → set the language for Indian numbers.

> reCAPTCHA is **invisible**: the store renders `<div id="recaptcha-container"></div>`
> and creates the verifier with `{ size: "invisible" }`, so customers never see a
> checkbox — Google only challenges genuinely suspicious traffic.
> Enable **reCAPTCHA Enterprise (Enforce mode)** in Firebase if you want Firebase
> to drop the reCAPTCHA requirement entirely.

---

## 3. How the flow works

```
┌─ Browser (src/components/phone-login.tsx) ────────────────────────────────┐
│ 1. customer types 9876543210  (validated: 10 digits, starts 6/7/8/9)      │
│ 2. signInWithPhoneNumber(auth, "+919876543210", RecaptchaVerifier)        │
│    └─ reCAPTCHA runs invisibly in #recaptcha-container; Firebase SMS the OTP
│ 3. customer types the 6-digit OTP → confirmationResult.confirm(code)      │
│ 4. user.getIdToken(true) → POST /api/auth/phone  { idToken, next, name }  │
└───────────────────────────────────────────────────────────────────────────┘
┌─ Server (src/app/api/auth/phone/route.ts) ────────────────────────────────┐
│ 5. verifyFirebasePhoneToken()  (src/lib/firebase-verify.ts)               │
│      • local claims: aud === project, iss, exp/iat, sub, sign_in_provider │
│        === "phone", phone_number present                                 │
│      • authoritative: Google Identity Toolkit `accounts:lookup` call      │
│ 6. upsertPhoneUser()  (src/lib/phone-users.ts) → users row                │
│ 7. createSession() + applySessionCookie() → identical to Google sign-in   │
└───────────────────────────────────────────────────────────────────────────┘
```

### Verification policy (`FIREBASE_PHONE_VERIFY`)

| Value | Behaviour | When to use |
|---|---|---|
| *(unset)* | `strict` in production, `jwt` elsewhere | default — recommended |
| `strict` | Google's Identity Toolkit must confirm the token. If Google is unreachable the route fails closed (503). | production |
| `jwt` | claims-only validation (no external call) | offline dev, sandboxes, preview hosts with no outbound internet |

Production builds are **always** strict unless you explicitly set
`FIREBASE_PHONE_VERIFY=jwt` — that override is a development escape hatch, not a
deployment option.

---

## 4. Where phone accounts are stored

| Column | Value for a +91 account |
|---|---|
| `users.phone_uid` | Firebase Auth uid (unique) — **the identity key** |
| `users.whatsapp` | the verified 10-digit number (also prefills checkout) |
| `users.email` | `NULL` — email is owned by Google |
| `users.role` | `customer` (staff/owner roles stay email-based) |

The columns are created automatically on the first request by
`ensureAuthTables()` (`src/lib/auth-tables.ts`). If you prefer running SQL
yourself, apply [`sql/007_phone_auth.sql`](./sql/007_phone_auth.sql) — it is
idempotent and non-destructive.

A verified phone login is **never** merged into an existing account just because
the WhatsApp number matches: identity matching uses the Firebase uid only, so a
pre-planted profile can't hijack a freshly verified number.

If the database is offline, sign-in still succeeds with a stateless session
(`users.id` = Firebase uid), exactly like the Google flow — orders then fall back
to the existing demo store.

---

## 5. Reusing the components

```tsx
// Anywhere in a client component — the full phone sign-in card
import PhoneLogin from "@/components/phone-login";
<PhoneLogin next="/checkout?product=PHARAOH%20XSUIT" />
```

Helpers you can import elsewhere:

```ts
// src/lib/phone-number.ts — pure, works on the server too
normalizeIndianMobile("+91 98765 43210"); // "9876543210"
toE164India("9876543210");                // "+919876543210"
maskIndianMobile("9876543210");           // "+91 ••••• 43210"

// src/lib/firebase-errors.ts — customer-friendly copy for any Firebase error
firebasePhoneAuthMessage(error);          // "That OTP is incorrect. Check the 6-digit code…"
```

---

## 6. Troubleshooting

| Symptom on screen | Real cause | Fix |
|---|---|---|
| "This domain is not authorised for phone sign-in yet." | `auth/unauthorized-domain` | Add the host in Firebase → Authentication → Settings → Authorised domains |
| "Phone sign-in is disabled for this Firebase project…" | `auth/operation-not-allowed` | Enable the **Phone** provider |
| "Daily SMS limit reached for this number…" | `auth/quota-exceeded` | Normal Firebase SMS quota — wait, or use test numbers |
| "Verification service is temporarily unavailable." | server couldn't reach `identitytoolkit.googleapis.com` while in `strict` mode | check the server's outbound network, or set `FIREBASE_PHONE_VERIFY=jwt` **for dev only** |
| "Phone sign-in is misconfigured: Firebase rejected the API key." | `auth/api-key-not-valid` — a malformed `NEXT_PUBLIC_FIREBASE_API_KEY` | nothing to do: the bad value is ignored and the built-in key is used. Delete/fix the variable in the hosting dashboard to silence the notice |
| "Phone sign-in is not configured on this deployment yet." | `NEXT_PUBLIC_FIREBASE_*` missing **and** even the built-in defaults were rejected | rebuild from a clean checkout; the defaults work with no variables at all |
| Login works but `/dashboard` bounces to `/login` | `AUTH_SECRET` changed between requests | set a stable `AUTH_SECRET` |

Live diagnostics: **`/api/auth/config-check`** reports which Firebase variables are
present, whether each one is **well-formed**, the active verification mode, and
prints the exact origin you must add to the Firebase authorised-domains list.
