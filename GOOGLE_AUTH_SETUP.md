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
| Visitor tracking | Every page view is written to `site_logs` (email, IP, page URL, timestamp, device, referrer) and shown in the **Visitor Logs** tab of the admin panel, with search, CSV export, pagination and auto-refresh. |

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
```

`site_logs` columns: `user_email`, `ip_address`, `page_url`, `created_at`
(plus `user_name`, `referrer`, `user_agent`, `country`, `city`).

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
   you must be redirected to `/login`.
2. Click **Continue with Google** → consent → you land on `/dashboard`
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
- Because **every** page now requires a login, search engines cannot crawl the
  store — the root layout therefore sets `robots: noindex`. If you ever want the
  catalog public again, add those paths to `PUBLIC_PATHS` in
  `src/lib/auth-config.ts` and restore `index: true`.
