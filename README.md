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

### Admin panel (`/admin`)
- Login: **MANAV / MANAV7412**
- Secure cookie session (12 hours, server-side protected)
- Logout
- Manage Accounts (add / edit / delete / enable)
- Manage UC packages
- Manage Coupons (percent / flat, expiry, usage limit)
- Orders list + status updates
- Customer messages inbox
- Site controls (WhatsApp, logo, socials, maintenance, headline)

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
- Username: `MANAV`
- Password: `MANAV7412`

---

## Environment variables

Create `.env`:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
```

Optional overrides (defaults already work without these):

```bash
# not required — owner is hardcoded as MANAV / MANAV7412
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
| `admins` / `admin_sessions` | Optional (login is cookie-based without DB) |

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
6. Login at `/admin` with `MANAV` / `MANAV7412`

---

## Key routes

| Path | Description |
|---|---|
| `/` | Home |
| `/accounts` | Account store |
| `/uc-purchase` | UC packages |
| `/checkout` | Buy flow + coupon |
| `/admin` | Admin login |
| `/admin/dashboard` | Control centre |
| `/api/health` | Health check |

---

## Notes

- Payment gateway shows maintenance notice by design — orders complete via official WhatsApp.
- Never claim official Krafton/BGMI affiliation.
- Screen recording recommended during account handover.
- Do not share OTPs.
