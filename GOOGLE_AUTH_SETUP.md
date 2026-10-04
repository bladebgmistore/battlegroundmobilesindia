# Google Login, Dashboard & Admin Visitor Tracking — Setup Guide

Everything below is already implemented in this repository. This guide tells you
how to configure and deploy it for **battlegroundmobilesindia.shop**.

---

## 1. What was built

| Requirement | Implementation |
|---|---|
| Remove password login | `/api/auth/login`, `/register`, `/forgot-password`, `/reset-password`, `/api/account/password`, `/api/admin/login`, `/api/admin/password`, `/signup`, the admin password screen and the password helper libs were **deleted**. `users.password_hash` is now nullable and unused. |
| Continue with Google | OAuth 2.0 **Authorization Code + PKCE** flow: `/auth/google` → Google → `/auth/google/callback`. |
| Compulsory auth | `src/middleware.ts` runs on every request. No session ⇒ redirect to `/login?next=…` (HTML) or `401 JSON` (API). |
| User dashboard | `/dashboard` — Google name, email and profile picture, recent orders, quick links. |
| RBAC | `OWNER_EMAIL` allow-list (default `manavjeph800@gmail.com`) ⇒ role `owner`; everyone else is `customer`. Owners see an **Open Admin Panel** button. |
| Admin area | `/admin` — owner-only (enforced in middleware *and* in the page via `requireOwner()`). |
| Visitor tracking | Every page view is written to `site_logs` (email, IP, page URL, timestamp, device, referrer) and shown in the **Visitor Logs** tab of the admin panel, with search, CSV export, pagination and auto-refresh. Signed-out homepage visitors are logged as **Guest**. |

### Key files

```
src/middleware.ts                      # compulsory auth + owner gate (Edge)
src/lib/auth-config.ts                 # cookie names, OWNER_EMAIL, public paths
src/lib/auth-session.ts                # HMAC-SHA256 signed session cookie (Edge-safe)
src/lib/auth.ts                        # getSession / requireSession / requireOwner
src/lib/google-oauth.ts                # auth URL, PKCE, token exchange, profile
src/lib/google-users.ts                # upsert user from Google profile
src/lib/auth-tables.ts                 # idempotent SQL bootstrap
src/lib/site-logs.ts                   # recordVisit / listSiteLogs / stats / purge
src/app/auth/google/route.ts           # step 1  → Google consent screen
src/app/auth/google/callback/route.ts  # step 2  → exchange + session cookie
src/app/auth/logout/route.ts           # sign out
src/app/login/page.tsx                 # "Continue with Google" screen
src/app/dashboard/page.tsx             # user dashboard
src/app/admin/page.tsx                 # owner-only admin panel
src/app/api/track/route.ts             # page-view beacon
src/app/api/admin/logs/route.ts        # owner-only log feed (GET) + purge (DELETE)
src/app/api/admin/users/route.ts       # owner-only user list
src/components/visit-tracker.tsx       # fires the beacon on every route change
src/components/admin-visitor-logs.tsx  # the log table UI
sql/001_google_auth_and_site_logs.sql  # the database schema
```

---

## 2. Database

Run the migration (or just deploy — the app applies it automatically on the
first request through `ensureAuthTables()`):

```bash
psql "$DATABASE_URL" -f sql/001_google_auth_and_site_logs.sql
psql "$DATABASE_URL" -f sql/002_feedback_moderation.sql
```

`site_logs` columns: `user_email`, `ip_address`, `page_url`, `created_at`
(plus `user_name`, `referrer`, `user_agent`, `country`, `city`).

`feedbacks` moderation columns (migration 002, auto-applied by
`ensureFeedbackTables()`): `status` (`pending` | `approved` | `rejected`),
`submitted_by_email`, `moderated_at`. Existing rows are migrated to
`approved` so nothing disappears from the live site.

---

## 3. Google Cloud Console

1. <https://console.cloud.google.com/apis/credentials> → your OAuth 2.0 Client ID
   `822938602122-d99qjh37o9gl4hu332ijrdjjjvum4f5p.apps.googleusercontent.com`.
2. **Authorised JavaScript origins**
   - `https://battlegroundmobilesindia.shop`
   - `http://localhost:3000` (for local dev)
3. **Authorised redirect URIs** (must match character-for-character)
   - `https://battlegroundmobilesindia.shop/auth/google/callback`
   - `http://localhost:3000/auth/google/callback`
4. **OAuth consent screen** → publish the app (**In production**) so any Google
   user can sign in; while it is in *Testing* only listed test users can log in.
   Scopes needed: `openid`, `email`, `profile` (non-sensitive, no verification).

---

## 4. Environment variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | your Neon/Postgres connection string |
| `GOOGLE_CLIENT_ID` | `822938602122-d99qjh37o9gl4hu332ijrdjjjvum4f5p.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | your client secret (keep it out of Git) |
| `GOOGLE_REDIRECT_URI` | `https://battlegroundmobilesindia.shop/auth/google/callback` |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `OWNER_EMAIL` | `manavjeph800@gmail.com` (comma-separate for more owners) |

> **Rotate the client secret.** It was shared in plain text while setting this
> up — open Google Cloud Console → *Reset secret*, then update
> `GOOGLE_CLIENT_SECRET` in your host's dashboard.

---

## 5. Deploy

### Vercel (recommended for Next.js 16)

```bash
npm i -g vercel
vercel link
vercel env add DATABASE_URL production
vercel env add GOOGLE_CLIENT_ID production
vercel env add GOOGLE_CLIENT_SECRET production
vercel env add GOOGLE_REDIRECT_URI production
vercel env add AUTH_SECRET production
vercel env add OWNER_EMAIL production
vercel --prod
```

Then **Settings → Domains → add `battlegroundmobilesindia.shop`** and point your
registrar's DNS at Vercel (`A 76.76.21.21` or the `CNAME` Vercel shows).

### Netlify

The repo already ships `netlify.toml` with `@netlify/plugin-nextjs`.
Add the same six variables in *Site configuration → Environment variables*, then:

```bash
npm i -g netlify-cli
netlify deploy --prod
```

### Local development

```bash
cp .env.example .env.local      # fill in the values
npm install
npm run dev                     # http://localhost:3000
```

---

## 6. Verify after deploying

1. Open `https://battlegroundmobilesindia.shop/` in a private window →
   the homepage loads with a **Login** button in the header. Click any other
   section (Accounts, UC Purchase, My Account…) → you are sent to `/login`.
2. Click **Login / Continue with Google** → consent → you land on `/dashboard`
   showing your name, email and photo.
3. Sign in as `manavjeph800@gmail.com` → the **Open Admin Panel** button
   appears → `/admin` → **Visitor Logs** tab shows your page views with
   email, IP, URL and timestamp.
4. Sign in with any other Google account → `/admin` redirects back to
   `/dashboard?error=forbidden`.

---

## 7. Security notes

- Session cookie is `httpOnly`, `SameSite=Lax`, `Secure` on HTTPS, signed with
  HMAC-SHA256 (`AUTH_SECRET`) and expires after 30 days.
- CSRF on the OAuth round-trip is covered by a one-time `state` value plus PKCE
  (`code_challenge` / `code_verifier`).
- `next=` redirects are restricted to same-site relative paths (no open redirect).
- The client never sees the client secret; the page-view beacon cannot forge the
  email or IP because both are read server-side from the session and headers.
- The homepage stays crawlable (`robots: index`); gated pages set their own
  `noindex`. To open more pages to guests, add them to `PUBLIC_PAGES` in
  `src/lib/auth-config.ts` (e.g. `"/terms"`, `"/refund-policy"`).

---

## 8. Troubleshooting

### "Google sign-in is not configured on this server yet"

This means the server booted **without** `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
The code never falls back to hardcoded secrets, so you must set them on the host.

1. Open `https://<your-domain>/api/auth/config-check` — it reports exactly which
   variables are missing (values are never exposed).
2. **Vercel** → Project → *Settings* → *Environment Variables* → add each one for
   the **Production** (and *Preview*, if you test there) environment:

   | Key | Value |
   |---|---|
   | `GOOGLE_CLIENT_ID` | `822938602122-d99qjh37o9gl4hu332ijrdjjjvum4f5p.apps.googleusercontent.com` |
   | `GOOGLE_CLIENT_SECRET` | your (rotated) client secret |
   | `GOOGLE_REDIRECT_URI` | `https://battlegroundmobilesindia.shop/auth/google/callback` |
   | `AUTH_SECRET` | output of `openssl rand -base64 32` |
   | `OWNER_EMAIL` | `manavjeph800@gmail.com` |
   | `DATABASE_URL` | your Neon connection string |

3. **Redeploy** — environment variables are baked in at deploy time, so an
   existing deployment will not pick them up. *Deployments → ⋯ → Redeploy*
   (uncheck "Use existing build cache" if unsure).
4. Reload `/api/auth/config-check`; `"ready": true` means you are good to go.

### `redirect_uri_mismatch` from Google

`effectiveRedirectUri` in the config check must appear **character-for-character**
in Google Cloud Console → *Credentials* → your OAuth client → *Authorised redirect URIs*.
Add both of these if you test on the Vercel URL too:

```
https://battlegroundmobilesindia.shop/auth/google/callback
https://<your-project>.vercel.app/auth/google/callback
```

### "Access blocked: app not verified" / only some accounts can log in

Google Cloud Console → *OAuth consent screen* → **Publish app**. While it is in
*Testing* mode only the listed test users can sign in.

### Logged in but `/admin` bounces to the dashboard

The signed-in email is not in the allow-list. Check `OWNER_EMAIL` in the config
check output and sign in with exactly that Google account.

### Visitor logs stay empty

`site_logs` needs a reachable database. Confirm `DATABASE_URL` is set
(`/api/auth/config-check`) and that `sql/001_google_auth_and_site_logs.sql` ran —
the app also creates the table automatically on the first authenticated request.

---

## 9. Storefront features added on top of auth

### 9.1 Separate logo and favicon (Admin → Site Controls)

| Setting key   | Used by                                   |
| ------------- | ----------------------------------------- |
| `logo_url`    | Header, footer and the admin sidebar logo |
| `favicon_url` | Browser tab icon only (`/api/favicon`)    |

Dono alag-alag image fields hain. `/api/favicon` pehle `favicon_url` padta hai
aur sirf tab `logo_url` par fallback karta hai jab alag favicon set na ho.
Dono fields PNG (transparency ke saath), JPG, WEBP aur SVG accept karte hain —
upload hone par PNG source ka alpha channel preserve hota hai (pehle sab kuch
JPEG me flatten ho jaata tha). Favicon change karne ke baad tab ko hard-refresh
karein, browsers icon ~5 minute cache karte hain.

### 9.2 Disabled category = sab kuch hide

`/api/store` sirf `is_active = true` categories return karta hai. Homepage ke
hero buttons ab usi list se generate hote hain, isliye ek category disable
karte hi uska hero button, uska section/shelf, header nav item aur footer link
— sab automatically gayab ho jaate hain.

### 9.3 Player reviews: submit → moderate → publish

1. Homepage ke "Player feedback" section me logged-in user **WRITE A REVIEW**
   se rating + text bhej sakta hai (`POST /api/feedbacks`, Google login
   zaroori, 3 reviews/day per user limit).
2. Har submission `status = 'pending'` ke saath save hoti hai — site par
   turant **nahi** dikhti.
3. Admin → **Feedbacks** me Pending / Live / Denied / All tabs hain, sidebar me
   pending count ka orange badge dikhta hai.
   - **ACCEPT & SHOW** → `status = 'approved'` → review homepage par live.
   - **DENY** → `status = 'rejected'` → hamesha hidden rehta hai.
4. Public `GET /api/feedbacks` sirf `approved` + `is_active` rows deta hai.
5. Reviews grid framer-motion se animated hai (staggered reveal + hover lift).
