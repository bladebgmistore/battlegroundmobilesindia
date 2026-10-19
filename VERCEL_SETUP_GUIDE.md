# Vercel Deployment Guide (Battlegrounds Mobile India Store)

This is a standard **Next.js 16 (App Router)** app — Vercel pe zero-config deploy hota hai.
Neeche 2 tarike hain. **Option A (GitHub integration) recommended** — har push pe auto-deploy.

---

## Option A — GitHub se deploy (recommended, 2 minute)

1. **PR merge karo**: is branch ka PR GitHub pe merge kar do, taaki `main` par latest code aa jaye.

2. **Vercel pe import karo**:
   - [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → `bladebgmistore/battlegroundmobilesindia` select karo
   - GitHub connect karne ke liye ek baar "Authorize Vercel" karna padega

3. **Framework Preset**: Vercel khud **Next.js** detect kar lega (build command `npm run build`, output auto) — kuch change mat karo.

4. **Environment Variables** add karo (Project → Settings → Environment Variables):

   | Key | Required | Value |
   |---|---|---|
   | `DATABASE_URL_DB1` | ✅ Yes | **DB1** — users, authentication, profiles, roles/permissions (Neon pooled string) |
   | `DATABASE_URL_DB2` | ✅ Yes | **DB2** — inventory, products, categories, items, pricing (Neon pooled string) |
   | `DATABASE_URL_DB3` | ✅ Yes | **DB3** — orders, transactions, payment logs, delivery proofs, referral points (Neon pooled string) |
   | `AUTH_SECRET` | ✅ Yes | `openssl rand -base64 32` se banao (session cookie sign hoti hai) |
   | `NEXTAUTH_URL` | ✅ Yes | `https://battlegroundmobilesindia.shop` (canonical site URL, trailing slash nahi) |
   | `OWNER_EMAIL` | ✅ Yes | `manavjeph800@gmail.com` — sirf isi account ko `/admin` milega |
   | `GOOGLE_CLIENT_ID` | ✅ Yes | `822938602122-d99qjh37o9gl4hu332ijrdjjjvum4f5p.apps.googleusercontent.com` |
   | `GOOGLE_CLIENT_SECRET` | ✅ Yes | Google Cloud Console wala OAuth client secret |
   | `GOOGLE_REDIRECT_URI` | ✅ Yes | `https://battlegroundmobilesindia.shop/auth/google/callback` |
   | `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` | Optional | `4056208531176598` (Meta Pixel — details: `META_PIXEL_SETUP.md`. Khali chhodo to tracking band) |
   | `CLERK_SECRET_KEY` | Optional | Clerk Dashboard → API keys (server-only) |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Optional | Clerk publishable key (browser bundle mein jaati hai) |
   | `SMTP_HOST` | Optional | `smtp.gmail.com` (admin OTP email ke liye) |
   | `SMTP_PORT` | Optional | `465` |
   | `SMTP_USER` | Optional | aapki email |
   | `SMTP_PASS` | Optional | Gmail App Password (16-char) |
   | `OTP_FROM` | Optional | `Battleground India Store <you@gmail.com>` |

   > ⚠️ Teenon database keys ke bina site chalegi lekin **demo fallback mode**
   > mein — orders/users persist nahi honge. Production mein hamesha teenon set karo.
   > Har database alag Neon project/endpoint hona chahiye; app unhe kabhi mix nahi karti.
   > Poora mapping: **`src/lib/env.ts`**.

5. **Deploy** dabao — 2-3 min mein live: `https://<project-name>.vercel.app`

6. **Har push pe auto-deploy**: baad mein sirf `git push` karo, Vercel khud build kar dega. PRs ke liye preview URL bhi milta hai.

7. **(Optional) Custom domain**: Project → Settings → Domains → apna domain add karo. Domain lagane ke baad `src/app/layout.tsx` mein `metadataBase` URL bhi update kar dena (SEO ke liye).

---

## Option B — Vercel CLI se deploy (aapke computer par)

```bash
npm install -g vercel
vercel login                 # browser se login
vercel link                  # project link karo
vercel env add DATABASE_URL_DB1   # users / auth / profiles / roles
vercel env add DATABASE_URL_DB2   # inventory / products / categories / pricing
vercel env add DATABASE_URL_DB3   # orders / payments / proofs / referral points
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
vercel env add GOOGLE_REDIRECT_URI
vercel env add NEXTAUTH_URL
vercel env add AUTH_SECRET
vercel env add OWNER_EMAIL
vercel --prod                # production deploy
```

> 🔒 Token/chat mein credentials kabhi share na karein. CLI login aapke hi machine par hota hai.

---

## Netlify → Vercel shift notes

- `netlify.toml` Vercel ignore kar deta hai — delete karne ki zaroorat nahi (dono parallel chala sakte ho).
- `@netlify/plugin-nextjs` devDependency Vercel pe koi asar nahi daalti.
- Custom Cache-Control headers (`next.config.ts` ke `headers()`) Vercel pe fully supported hain.
- Current Netlify domain `metadataBase` (`src/app/layout.tsx`) mein set hai — Vercel domain primary banega to usko update karein.

---

## Post-deploy checklist

- [ ] `/api/health` 200 de raha hai
- [ ] `/api/auth/config-check` kholein — `ready: true` hona chahiye; `missing` list khaali honi chahiye
- [ ] Guest cart → Google sign-in → checkout/order flow test karo (login checkout ke liye **compulsory** hai); verify the OAuth redirect URI in Google Cloud Console
- [ ] Admin panel (`/admin`) login + catalog save test karo
- [ ] Payment QR aapke real UPI ID se generate ho raha hai (admin → Payment & Checkout Control)
- [ ] Naya order aane par Telegram alert aa raha hai (agar `TELEGRAM_BOT_TOKEN` set hai)

---

## Environment variable mapping

Saari env vars ek hi jagah resolve hoti hain — **`src/lib/env.ts`**:

| Group | Variables |
|---|---|
| Database 1 (users/auth) | `DATABASE_URL_DB1` |
| Database 2 (inventory/pricing) | `DATABASE_URL_DB2` |
| Database 3 (orders/proofs/points) | `DATABASE_URL_DB3` |
| Database (diagnostics) | `BGMISTORE_NEON_PROJECT_ID` |
| Session | `AUTH_SECRET` (alias `NEXTAUTH_SECRET`) |
| Site URL | `NEXTAUTH_URL` |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| Clerk | `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` |
| Roles | `OWNER_EMAIL` |
| Meta Pixel | `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` |
| Optional | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `OTP_FROM`, `TELEGRAM_BOT_TOKEN`, `ADMIN_CHAT_ID`, `BGMI_UID_API_URL`, `BGMI_UID_API_KEY`, `STORE_DEMO_CATALOG` |

Teenon database keys ke bina bhi build clean pass hoti hai (database client
lazy hai) — site sirf demo data dikhati hai.
