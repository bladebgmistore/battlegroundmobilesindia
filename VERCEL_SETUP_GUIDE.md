# Vercel Deployment Guide — Battlegrounds Mobile India Store (Clerk Auth)

This is a **Next.js 16 (App Router) + Clerk Authentication** app — Vercel pe zero-config deploy hota hai.

---

## Clerk Authentication (New — replaces custom Google OAuth)

### 1. Clerk Dashboard Setup

1. Go to https://dashboard.clerk.com → Create or select your app for `battlegroundmobilesindia.shop`
2. **API Keys:** Copy `Publishable Key` and `Secret Key` (LIVE keys for production)
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY=sk_live_YOUR_SECRET_KEY`
3. **Login Methods — Enable in Clerk Dashboard:**
   - **User & Authentication → Social Connections → Google:** Enable, add Google OAuth credentials
   - **User & Authentication → Email, Phone, Usernames:**
     - Enable **Email address** → Enable **Email code (OTP)** + **Magic Link**
     - Enable **Phone number** → Enable **SMS code (OTP)**
   - The `<SignIn>` UI automatically shows all enabled methods
4. **Paths:** Set Sign-in URL `/sign-in`, Sign-up URL `/sign-up`, After sign-in `/dashboard`, After sign-up `/dashboard`
5. **Domains:** Add `battlegroundmobilesindia.shop` and Vercel preview domains to allowed origins

### 2. Environment Variables (Vercel)

Go to **Vercel → Project → Settings → Environment Variables** and add:

| Key | Required | Value / Example |
|---|---|---|
| `DATABASE_URL` | ✅ Yes | Neon/Postgres connection string `postgresql://...?sslmode=require` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ Yes | `pk_live_YOUR_PUBLISHABLE_KEY` |
| `CLERK_SECRET_KEY` | ✅ Yes | `sk_live_YOUR_SECRET_KEY` |
| `OWNER_EMAIL` | ✅ Yes | `manavjeph800@gmail.com` — primary owner, gets full `/admin` access |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Optional | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Optional | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Optional | `/dashboard` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Optional | `/dashboard` |

> ⚠️ Old vars `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `AUTH_SECRET` are **deprecated** — kept only for DB compatibility, not used by Clerk. You can remove them after migration.

### 3. Deploy

- **Option A — GitHub integration (recommended):**
  1. Merge this branch `arena/64c37df2-battlegroundmobilesindia` → `main` on GitHub
  2. Vercel → New Project → Import `bladebgmistore/battlegroundmobilesindia`
  3. Framework preset auto-detects Next.js
  4. Add env vars above
  5. Deploy → live in 2-3 min

- **Option B — Vercel CLI:**
  ```bash
  npm i -g vercel
  vercel login
  vercel link
  vercel env add DATABASE_URL
  vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  vercel env add CLERK_SECRET_KEY
  vercel env add OWNER_EMAIL
  vercel --prod
  ```

---

## What Changed (Clerk Migration)

- **Old:** Custom HMAC session cookie `bgmi_session`, Google OAuth routes `/auth/google/*`, `src/proxy.ts` checked `SESSION_COOKIE`
- **New:** Clerk session via `auth()` / `currentUser()` from `@clerk/nextjs/server`, `src/proxy.ts` uses `clerkMiddleware` with `auth.protect()` for compulsory auth
- **Layout:** Wrapped with `<ClerkProvider>`
- **Login UI:** `/sign-in/[[...sign-in]]` and `/sign-up/[[...sign-up]]` using Clerk's `<SignIn>` / `<SignUp>` components
- **Owner/Admin:** `manavjeph800@gmail.com` hardcoded + `OWNER_EMAIL` env, plus `staff_members` table for team roles — checked in `src/lib/clerk-auth.ts`
- **Visitor Tracking:** `/api/track` now uses Clerk user email, logs email + IP + URL + timestamp into `site_logs`, displayed in Admin → Visitor Logs
- **Compatibility:** `src/lib/auth.ts` kept as wrapper so old imports still work, but delegates to Clerk

---

## Post-deploy Checklist

- [ ] `/sign-in` shows Clerk UI with Google, Email OTP, Phone OTP options (if enabled in dashboard)
- [ ] Unauthenticated visit to `/` → redirects to `/sign-in`
- [ ] Sign in with Google → lands on `/dashboard`
- [ ] Sign in as `manavjeph800@gmail.com` → `/admin` accessible, Owner badge visible
- [ ] Regular user → `/admin` redirects to `/dashboard?error=forbidden`
- [ ] Browse pages → Admin → Visitor Logs shows email, IP, URL, timestamp
- [ ] `/api/auth/session` returns Clerk user with role
- [ ] `/api/health` returns 200
- [ ] Build passes: `npm run build`

---

## Middleware Note (Next.js 16)

Next.js 16 renamed `middleware.ts` → `proxy.ts`. This project uses `src/proxy.ts` with `clerkMiddleware`. If you see docs mentioning `middleware.ts`, use the same code in `proxy.ts`. Do not create both files — Next.js errors if both exist.

**`src/proxy.ts` code:**
```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);
export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) await auth.protect();
});
export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
```

