# Netlify Database Setup Guide (Step-by-Step)

To make your **BATTLEGORUND MOBILE INDIA STORE** admin panel fully dynamic (allowing you to add, edit, delete and modify products, coupons, WhatsApp settings, and manage admin users), you need to connect your live PostgreSQL database to Netlify.

Follow these 4 simple steps to get everything running in 2 minutes for free!

---

### Step 1: Get a Free PostgreSQL Database

You can get a free, secure PostgreSQL database from **Neon** or **Supabase** in 1 minute.

#### Option A: Using Neon (Recommended - easiest)
1. Go to [https://neon.tech](https://neon.tech) and sign up for a free account.
2. Click **Create Project**, name it `bgmi-store`, and choose your region.
3. Once created, copy the **Connection String** shown on your dashboard. It looks like this:
   `postgresql://neondb_owner:xyz...abc@ep-cool-breeze-a5.us-east-2.aws.neon.tech/neondb?sslmode=require`

#### Option B: Using Supabase
1. Go to [https://supabase.com](https://supabase.com) and sign up.
2. Create a new project, set a database password, and choose your region.
3. Once created, go to **Project Settings → Database → Connection string → URI** and copy the string.

---

### Step 2: Add the 3 database keys to Netlify

Now, supply this connection string to Netlify so your site can read and write live data.

1. Go to your **Netlify Dashboard** (where you deployed your website).
2. Click on your site, then go to **Site configuration → Environment variables**.
3. Click **Add a variable** three times and enter one key per database:
   - **Key:** `DATABASE_URL_DB1` — **Value:** DB1 connection string (users, auth, profiles, roles)
   - **Key:** `DATABASE_URL_DB2` — **Value:** DB2 connection string (inventory, products, categories, pricing)
   - **Key:** `DATABASE_URL_DB3` — **Value:** DB3 connection string (orders, payments, proofs, referral points)
4. Set the scopes to **All scopes** (Builds, Functions, Prerender) and click **Save**.
5. Trigger a new deploy (**Deploys → Trigger deploy → Deploy site**) so Netlify rebuilds the application with the live database connected.

---

### Step 3: Push your Database Schema

You must run a one-time command to automatically create the required tables in **all three** databases.

Open your local terminal (or the sandbox terminal) in the project folder and run:

```bash
npm run db:push
```

This pushes each schema to its own database:
- **DB1:** `users`, `staff_members`, `site_logs` (+ legacy auth tables)
- **DB2:** `categories`, `products`, `accounts`, `uc_packages`, `special_products`, `coupons`, `site_settings`, `feedbacks`
- **DB3:** `orders`, `customer_messages`, `customer_proofs`, `referral_commissions`, `reward_items`, `point_redemptions`, `support_tickets`, `support_messages`, `user_notifications`, `notification_reads`, `announcements`

Optionally run `npm run db:init` to seed the starter catalog and site settings.

---

### Step 4: Login & Enjoy!

Add these environment variables in **Site configuration → Environment variables**:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` from your Google OAuth client
- `AUTH_SECRET` (run `openssl rand -base64 32`)
- `OWNER_EMAIL` = `manavjeph800@gmail.com`
- `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` = `4056208531176598` (Meta Pixel tracking — see `META_PIXEL_SETUP.md`; blank/omit to disable)

Register `https://<your-domain>/auth/google/callback` as an Authorized redirect URI on the Google OAuth client. Then open `/login`, click **Continue with Google**, and sign in with the owner account before opening `/admin`.

#### You can now:
- ✅ **Add / Edit / Delete Accounts & UC Packages** instantly from the panel.
- ✅ **Toggle Maintenance Mode** to show a global payment maintenance banner to all storefront visitors instantly.
- ✅ **Change your WhatsApp Support Number** in real-time under **Site controls** to instantly update every checkout page and chat link on the public site!
- ✅ **Monitor live visitor logs** under the **Visitor Logs** tab — user email, IP address, page URL and timestamp for every page view.
- ✅ **Review every signed-in Google account** under the **Users & Access** tab.
