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
- **Homepage is public** with a *Login* button in the header; `src/proxy.ts`
  gates every other page and API route and redirects guests to `/login?next=…`
  (allow-list: `PUBLIC_PAGES` in `src/lib/auth-config.ts`)
- Signed (HMAC-SHA256), `httpOnly`, 30-day session cookie
- Old email/WhatsApp + password login, signup, OTP reset and admin password
  login have been removed

### Refer & Earn + Points Store
- **Unique referral code** for every account. Signing up through a `?ref=CODE` link (any page of the store) links the new account to its referrer (`users.referred_by`). Accounts created before this feature get a code on their next sign-in.
- **Refer & Win pop-up**: right after a Google sign-in the user sees their referral link with a **Copy** button (and a WhatsApp share).
- **Refer & Earn** (`/refer-earn`, header menu): total referrals, friends who bought, points earned, available points, referred friends (masked emails) and a full points history.
- **20% commission**: when a referred friend's order reaches `payment_confirmed` or `delivered`, the referrer is credited 20% of the amount the friend paid, as points (1 point = ₹1, rounded down). Cancelling, moving back or deleting that order reverses it.
- **Points Store** (`/rewards`): spend points on UC packages. The seeded example is **3800 UC for 2000 points**. Points are deducted immediately and a *pending* request is created with the buyer's BGMI character ID.
- **Admin → Referrals & Points** (owner / admin / manager): referral tree, commission logs, the redemption queue (**Pending / Completed / Refunded**: complete after delivering the UC, or reject to refund the points) and points-store item management.

### Customer Proofs / Order Deliveries (`/proofs`)
- **Public proofs page** (no sign-in needed): a responsive grid of verified deliveries. Every card shows the proof image/invoice, the **customer name**, the **order id** (`#ORD-xxxx`), the **exact product title**, the **amount paid (₹)** and the delivery date. Clicking an image opens it in a lightbox.
- **26 pre-loaded proofs** with the exact titles and prices from the product brief — 6 UC packs (₹500 → ₹5,000) and 20 BGMI accounts (₹999 → ₹12,999). They are seeded automatically the first time the app runs (`src/lib/proof-seed.ts` is the single source of truth).
- **Homepage CTA**: a green **VERIFIED PROOFS** button in the hero (next to *How to Buy* / category buttons) plus **Verified Proofs** links in the header menu and the footer.
- **Admin → Customer Proofs** (owner / admin / manager): publish a proof by entering the customer name, product title, amount (₹), delivery date and the proof image (upload — auto-compressed in the browser — or paste a URL). The **Order ID is generated for you** (`#ORD-xxxx`) when you leave it blank. Proofs can be hidden (`is_active`) or deleted, and every change is live on `/proofs` instantly.
- Receipt artwork for the seeded rows lives in `public/proofs/`; replace any of them with a real invoice/screenshot from the admin panel whenever you like.

### User dashboard (`/dashboard`)
- Google profile name, email and picture
- Recent orders + quick links to the store
- **Open Admin Panel** button for the owner account

### Admin panel (`/admin`) — staff roles (owner / admin / manager / moderator)
- The **owner** comes from the `OWNER_EMAIL` env allow-list (default
  `manavjeph800@gmail.com`) and can never be edited from the UI
- **Team & Roles** (owner only): add **admins, managers and moderators** by
  their Google email — no redeploy, no password. They just sign in with
  Google and the admin panel opens with their role's permissions. Suspend /
  re-role / remove takes effect instantly
- Role permissions (enforced in the UI *and* every admin API):
  | Role | Can manage |
  |---|---|
  | `owner` | Everything, including Team & Roles |
  | `admin` | Everything except Team & Roles |
  | `manager` | Catalog, UC, coupons, orders, referrals & points, customer proofs, messages, feedbacks, users |
  | `moderator` | Messages, feedback moderation, users |
- The workspace is organised into sections: **Main** (Overview), **Catalog**,
  **Operations**, **Insights** and **Settings** — staff only see what their
  role unlocks
- **Visitor Logs**: every page view with user email, IP address, page URL and
  timestamp, with search, pagination, CSV export, auto-refresh and purge
- **Users**: every Google account that has signed in, with its current role
- Manage Accounts (add / edit / delete / enable)
- Manage UC packages
- Manage Coupons (percent / flat, expiry, usage limit)
- Orders list + status updates
- Customer Proofs (publish / edit / hide / delete verified deliveries)
- Customer messages inbox
- Site controls (WhatsApp, logo, socials, maintenance, headline)

> Full configuration and deployment instructions: **[GOOGLE_AUTH_SETUP.md](./GOOGLE_AUTH_SETUP.md)**
> Database schema: **[sql/001_google_auth_and_site_logs.sql](./sql/001_google_auth_and_site_logs.sql)**, **[sql/002_feedback_moderation.sql](./sql/002_feedback_moderation.sql)**, **[sql/003_staff_members.sql](./sql/003_staff_members.sql)**, **[sql/004_referral_and_points.sql](./sql/004_referral_and_points.sql)**, **[sql/005_customer_proofs.sql](./sql/005_customer_proofs.sql)**

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
| `users` | Google accounts (name, email, `google_id`, avatar, role) + `referral_code`, `referred_by`, `points_balance` |
| `staff_members` | Team roles — email → admin / manager / moderator (managed from Admin → Team & Roles) |
| `site_logs` | Visitor tracking — email, IP, page URL, timestamp |
| `referral_commissions` | Commission ledger — one row per confirmed purchase of a referred user (unique per order; `credited` / `reversed`) |
| `point_redemptions` | Points → UC requests (`pending` / `completed` / `rejected`, rejected = refunded) |
| `reward_items` | Points store catalogue (UC amount, points cost, visibility) |
| `customer_proofs` | Verified deliveries on `/proofs` — customer name, unique `order_code` (`#ORD-xxxx`), product title, amount, proof image, visibility |
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
| `/refer-earn` | Refer & Earn dashboard (link, totals, referred friends, points history) |
| `/rewards` | Points Store — redeem points for UC |
| `/proofs` | Customer Proofs — public grid of verified order deliveries |
| `/api/proofs` | Public feed of active proofs |
| `/api/admin/proofs` | Staff: create / edit / hide / delete proofs |
| `/account` | Customer orders + profile |
| `/admin` | Owner-only admin panel (incl. Visitor Logs) |
| `/api/track` | Page-view beacon |
| `/api/admin/logs` | Visitor logs feed (owner only) |
| `/api/health` | Health check |
| `/api/referrals` | Signed-in referral dashboard data |
| `/api/rewards` | Store items, points balance and own redemptions |
| `/api/rewards/redeem` (POST) | Spend points on a reward |
| `/api/admin/referrals` | Staff: referral tree + commission logs |
| `/api/admin/redemptions` | Staff: redemption queue; PATCH to complete or reject & refund |
| `/api/admin/rewards` | Staff: points store items (create / edit / delete) |

---

## Refer & Earn rules

- **Attribution** happens only for brand-new accounts that sign up through a referral link. Existing accounts are never re-attributed. The latest referral link opened before signing up is the one credited.
- **Commission** = `floor(amount paid × 20%)` points, where *amount paid* is the order total after coupons. It is credited once per order (`referral_commissions.order_id` is unique) when the order is `payment_confirmed` or `delivered`, and reversed when it is cancelled, moved back to an unconfirmed status or deleted.
- **OTP copies** created by the account verification flow are stored with `orders.commissionable = false`, so one purchase never earns commission twice.
- **Redemptions** debit the balance and create the request in a single SQL statement, so no partial state is possible. Rejecting a pending request refunds the points exactly once. If a commission is reversed after its points were spent, the balance can go negative and new redemptions are blocked until it is positive again.
- The commission sync is idempotent. It runs on every order status change and whenever the admin Referrals view loads, so a missed update heals itself.

## Notes

- Payment gateway shows maintenance notice by design — orders complete via official WhatsApp.
- Never claim official Krafton/BGMI affiliation.
- Screen recording recommended during account handover.
- Do not share OTPs.
