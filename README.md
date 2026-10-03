# Battleground Mobile India Store

Premium BGMI accounts & UC marketplace built with **Next.js**, **TypeScript**, **Tailwind CSS**, **Framer Motion**, **PostgreSQL**, and **Drizzle ORM**.

> Independent digital marketplace. Not affiliated with or endorsed by Krafton or BGMI.

---

## What's included

### Public storefront
- Home, Accounts, UC Purchase, Checkout
- Is It Safe?, How To Buy, Terms, Refund Policy, Contact
- Premium dark gaming UI (black / gold / neon green)
- Coupon apply on checkout
- WhatsApp handoff (payment gateway under maintenance notice)
- Dynamic WhatsApp number, social links, maintenance banner
- Mobile responsive + SEO metadata + branded 404

### Authentication — Google Sign-In only
- **Continue with Google** (OAuth 2.0, Authorization Code + PKCE) — no passwords anywhere
- **Homepage is public** with a *Login* button in the header; `src/middleware.ts`
  gates every other page and API route and redirects guests to `/login?next=…`
  (allow-list: `PUBLIC_PAGES` in `src/lib/auth-config.ts`)
- Signed (HMAC-SHA256), `httpOnly`, 30-day session cookie
- Old email/WhatsApp + password login, signup, OTP reset and admin password
  login have been removed

### User dashboard (`/dashboard`)
- Google profile name, email and picture
- Recent orders + quick links to the store
- **Open Admin Panel** button for the owner account

### Admin panel (`/admin`) — owner only
- Access is granted by **email allow-list** (`OWNER_EMAIL`, default
  `manavjeph800@gmail.com`); everyone else is bounced to `/dashboard`
- **Visitor Logs**: every page view with user email, IP address, page URL and
  timestamp, with search, pagination, CSV export, auto-refresh and purge
- **Users & Access**: every Google account that has signed in
- Manage Accounts (add / edit / delete / enable)
- Manage UC packages
- Manage Coupons (percent / flat, expiry, usage limit)
- Orders list + status updates
- Customer messages inbox
- Site controls (WhatsApp, logo, socials, maintenance, headline)

> Full configuration and deployment instructions: **[GOOGLE_AUTH_SETUP.md](./GOOGLE_AUTH_SETUP.md)**
> Database schema: **[sql/001_google_auth_and_site_logs.sql](./sql/001_google_auth_and_site_logs.sql)**

---

## Local setup

```bash
npm install
npx drizzle-kit push
npm run dev
```

Open `http://localhost:3000`

### Admin
- URL: `/admin`
- Sign in with the owner Google account (`OWNER_EMAIL`, default `manavjeph800@gmail.com`)

---

## Environment variables

Copy `.env.example` → `.env.local` and fill it in:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
GOOGLE_CLIENT_ID=822938602122-d99qjh37o9gl4hu332ijrdjjjvum4f5p.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://battlegroundmobilesindia.shop/auth/google/callback
AUTH_SECRET=$(openssl rand -base64 32)
OWNER_EMAIL=manavjeph800@gmail.com
```

For production on Netlify / Vercel, add `DATABASE_URL` in the host environment settings, then run:

```bash
npx drizzle-kit push
```

against the production database once.

---

## Database tables

| Table | Purpose |
|---|---|
| `accounts` | Account listings |
| `uc_packages` | UC packages |
| `coupons` | Promo coupons |
| `orders` | Checkout requests |
| `customer_messages` | Contact form inbox |
| `site_settings` | Public site settings |
| `users` | Google accounts (name, email, `google_id`, avatar, role) |
| `site_logs` | Visitor tracking — email, IP, page URL, timestamp |
| `user_sessions` / `admins` / `admin_sessions` / `password_resets` | Legacy, unused since Google Sign-In (kept so `drizzle-kit push` never drops them) |

If the database is offline, the storefront still shows default catalog data and checkout still opens WhatsApp.

---

## Production deploy (Netlify)

1. Connect the Git repo
2. Build command: `npm run build` (already in `netlify.toml`)
3. Add env var: `DATABASE_URL`
4. Deploy
5. After first deploy, push schema once:
   ```bash
   npx drizzle-kit push
   ```
6. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `AUTH_SECRET`, `OWNER_EMAIL`
7. Sign in at `/login` with the owner Google account, then open `/admin`

---

## Key routes

| Path | Description |
|---|---|
| `/` | Home |
| `/accounts` | Account store |
| `/uc-purchase` | UC packages |
| `/checkout` | Buy flow + coupon |
| `/login` | Continue with Google (only public page) |
| `/auth/google` → `/auth/google/callback` | OAuth 2.0 flow |
| `/auth/logout` | Sign out |
| `/dashboard` | User dashboard (profile, orders, admin link) |
| `/account` | Customer orders + profile |
| `/admin` | Owner-only admin panel (incl. Visitor Logs) |
| `/api/track` | Page-view beacon |
| `/api/admin/logs` | Visitor logs feed (owner only) |
| `/api/health` | Health check |

---

## Notes

- Payment gateway shows maintenance notice by design — orders complete via official WhatsApp.
- Never claim official Krafton/BGMI affiliation.
- Screen recording recommended during account handover.
- Do not share OTPs.
