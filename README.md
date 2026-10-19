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

### Shopping cart
- **Navbar cart icon with a live badge** (total units), visible on desktop *and* mobile
- **Slide-over cart drawer** — line items, quantity −/+, remove, *you save*, total payable, *clear cart*, `Esc`/backdrop to close
- **Add to Cart** on every product card (home shelves, UC tiles, `/accounts` grid + quick view, `/uc-purchase`, category pages) with an **ADDED ✓** confirmation
- Cart state = **React Context + `useSyncExternalStore`**, persisted in **`localStorage`** (survives reloads, synced across tabs, SSR-safe)
- Checkout strips into the existing flow: `/checkout?...&cart=1`, UID requirement detected automatically, cart emptied once the order is registered
- Guests can browse, add products and manage the cart freely; checkout redirects to Google sign-in with the cart destination preserved, then returns to checkout after authentication
- Full walkthrough: **[CART_SETUP.md](./CART_SETUP.md)**

### Authentication — custom Google Sign-In only
- Google OAuth 2.0 **Authorization Code + PKCE** flow: `/auth/google` → Google → `/auth/google/callback`.
- Google profile is verified by the server before issuing a signed, `httpOnly`, 30-day application session cookie.
- `/login` is the single Google sign-in page, styled to match the site's light storefront theme.
- Browsing, categories and cart actions are public; checkout and order APIs require a signed-in account. Guests are sent to `/login?next=…` and returned to their selected checkout after sign-in.
- Setup / troubleshooting: **[GOOGLE_AUTH_SETUP.md](./GOOGLE_AUTH_SETUP.md)**.
- Only the custom Google sign-in method is supported; legacy password sign-in has been removed.

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
> Database schema: generated migrations live in **[drizzle/db1](./drizzle/db1)**, **[drizzle/db2](./drizzle/db2)** and **[drizzle/db3](./drizzle/db3)**.

---

## Local setup

```bash
npm install
npm run db:push   # creates the DB1/DB2/DB3 schemas
npm run db:init   # optional: seeds the demo catalog + site settings
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
# Three separate Neon PostgreSQL databases
DATABASE_URL_DB1=postgresql://user:password@ep-db1-pooler.region.aws.neon.tech/neondb?sslmode=require
DATABASE_URL_DB2=postgresql://user:password@ep-db2-pooler.region.aws.neon.tech/neondb?sslmode=require
DATABASE_URL_DB3=postgresql://user:password@ep-db3-pooler.region.aws.neon.tech/neondb?sslmode=require
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REDIRECT_URI=https://your-domain.example/auth/google/callback
NEXTAUTH_URL=https://your-domain.example
AUTH_SECRET=$(openssl rand -base64 32)
OWNER_EMAIL=manavjeph800@gmail.com
NEXT_PUBLIC_FACEBOOK_PIXEL_ID=4056208531176598
```

Every variable is resolved in one place — `src/lib/env.ts` — so the mapping
between the hosting dashboard and the code stays auditable:

| Variable | Used for |
|---|---|
| `DATABASE_URL_DB1` | **DB1** — User accounts, authentication, profiles, roles/permissions, login logs |
| `DATABASE_URL_DB2` | **DB2** — Store inventory: categories, products, accounts, UC packages, coupons, pricing, site settings, reviews |
| `DATABASE_URL_DB3` | **DB3** — Orders, transactions, payment logs, support tickets, delivery proofs, referral commissions & points |
| `BGMISTORE_NEON_PROJECT_ID` | Optional Neon project id (diagnostics only) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google OAuth 2.0 (Authorization Code + PKCE) |
| `NEXTAUTH_URL` | Canonical site URL; OAuth redirect base when `GOOGLE_REDIRECT_URI` is omitted |
| `AUTH_SECRET` (alias `NEXTAUTH_SECRET`) | HMAC key that signs the `bgmi_session` cookie |
| `OWNER_EMAIL` | Comma-separated owner allow-list (gets the `owner` role) |
| `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk keys — validated by `/api/auth/config-check` |
| `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` | Meta Pixel (public by design) |

`NEXT_PUBLIC_FACEBOOK_PIXEL_ID` is public by design (it ships in the browser
bundle). Blank it out to disable Meta Pixel tracking in that environment — the
`<MetaPixel />` component then renders nothing. Full walkthrough:
[META_PIXEL_SETUP.md](./META_PIXEL_SETUP.md).

For production on Netlify / Vercel, add `DATABASE_URL_DB1`, `DATABASE_URL_DB2` and
`DATABASE_URL_DB3` in the host environment settings, then create the tables in
each database once:

```bash
npm run db:push   # pushes the DB1, DB2 and DB3 schemas in order
# or individually:
npm run db:push:db1
npm run db:push:db2
npm run db:push:db3
```

---

## Database tables

### Database 1 — users & auth (`src/db/schemas/db1.ts`)
| Table | Purpose |
|---|---|
| `users` | Google accounts (name, email, `google_id`, `whatsapp`, avatar, role) + `referral_code`, `referred_by`, `points_balance` |
| `staff_members` | Team roles — email → admin / manager / moderator (Admin → Team & Roles) |
| `site_logs` | Visitor tracking — email, IP, page URL, timestamp |
| `admins`, `user_sessions`, `admin_sessions`, `password_resets` | Legacy, unused since Google Sign-In (kept for schema compatibility) |

### Database 2 — inventory & pricing (`src/db/schemas/db2.ts`)
| Table | Purpose |
|---|---|
| `categories` | Store categories (slug, image, sort order) |
| `products` | Product listings and prices |
| `accounts` | BGMI account listings |
| `uc_packages` | UC packages |
| `special_products` | Supercar / X-Suit listings |
| `coupons` | Promo coupons (validated from DB2, usage counted on checkout) |
| `site_settings` | Public site settings (WhatsApp, UPI, logo, maintenance mode) |
| `feedbacks` | Player reviews + moderation state |

### Database 3 — orders, proofs & points (`src/db/schemas/db3.ts`)
| Table | Purpose |
|---|---|
| `orders` | Checkout requests, payment status, delivery credentials/OTP |
| `customer_messages` | Contact form inbox |
| `referral_commissions` | Commission ledger — one row per confirmed purchase of a referred user (unique per order; `credited` / `reversed`) |
| `point_redemptions` | Points → UC requests (`pending` / `completed` / `rejected`, rejected = refunded) |
| `reward_items` | Points store catalogue (UC amount, points cost, visibility) |
| `customer_proofs` | Verified deliveries on `/proofs` — customer name, unique `order_code` (`#ORD-xxxx`), product title, amount, proof image, visibility |
| `support_tickets` / `support_messages` | Order-based "Chat with Admin" tickets |
| `announcements` / `user_notifications` / `notification_reads` | Broadcasts and the header bell inbox |

If the database is offline, the storefront still shows default catalog data and checkout still opens WhatsApp.

---

## Production deploy (Netlify)

1. Connect the Git repo
2. Build command: `npm run build` (already in `netlify.toml`)
3. Add env vars: `DATABASE_URL_DB1`, `DATABASE_URL_DB2`, `DATABASE_URL_DB3`
4. Deploy
5. After first deploy, push each schema once:
   ```bash
   npm run db:push
   ```
6. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `NEXTAUTH_URL`, `AUTH_SECRET`, and `OWNER_EMAIL`
7. Register `https://your-domain.example/auth/google/callback` (replace with your domain) as an Authorized redirect URI on the Google OAuth client
8. Sign in at `/login` with the owner Google account, then open `/admin`

---

## Key routes

| Path | Description |
|---|---|
| `/` | Home |
| `/accounts` | Account store |
| `/uc-purchase` | UC packages |
| `/checkout` | Buy flow + coupon (`?cart=1` = multi-item cart checkout) |
| `/login` | Sign in with the custom Google OAuth flow |
| `/auth/google` → `/auth/google/callback` | Google OAuth 2.0 Authorization Code + PKCE flow |
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

- **Attribution** happens only for brand-new accounts created after following a referral link. Existing accounts are never re-attributed. The latest referral link opened before the first sign-in is the one credited.
- **Commission** = `floor(amount paid × 20%)` points, where *amount paid* is the order total after coupons. It is credited once per order (`referral_commissions.order_id` is unique) when the order is `payment_confirmed` or `delivered`, and reversed when it is cancelled, moved back to an unconfirmed status or deleted.
- **OTP copies** created by the account verification flow are stored with `orders.commissionable = false`, so one purchase never earns commission twice.
- **Redemptions** debit the balance and create the request in a single SQL statement, so no partial state is possible. Rejecting a pending request refunds the points exactly once. If a commission is reversed after its points were spent, the balance can go negative and new redemptions are blocked until it is positive again.
- The commission sync is idempotent. It runs on every order status change and whenever the admin Referrals view loads, so a missed update heals itself.

## Notes

- Payment gateway shows maintenance notice by design — orders complete via official WhatsApp.
- Never claim official Krafton/BGMI affiliation.
- Screen recording recommended during account handover.
- Do not share OTPs.
