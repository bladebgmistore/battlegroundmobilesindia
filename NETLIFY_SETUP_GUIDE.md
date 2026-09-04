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

### Step 2: Add `DATABASE_URL` to Netlify

Now, supply this connection string to Netlify so your site can read and write live data.

1. Go to your **Netlify Dashboard** (where you deployed your website).
2. Click on your site, then go to **Site configuration → Environment variables**.
3. Click **Add a variable** and enter:
   - **Key:** `DATABASE_URL`
   - **Value:** Paste your connection string from Step 1.
4. Set the scopes to **All scopes** (Builds, Functions, Prerender) and click **Save**.
5. Trigger a new deploy (**Deploys → Trigger deploy → Deploy site**) so Netlify rebuilds the application with the live database connected.

---

### Step 3: Push your Database Schema

You must run a one-time command to automatically create the required tables in your database.

Open your local terminal (or the sandbox terminal) in the project folder and run:

```bash
npx drizzle-kit push
```

Drizzle will automatically connect to your database, create the following tables, and seed the default owner account:
- `accounts` (Premium game accounts)
- `uc_packages` (UC Top-up options)
- `coupons` (Checkout promo codes)
- `orders` (Checkout requests)
- `customer_messages` (Support Inbox)
- `site_settings` (Dynamic WhatsApp number, Logo override, and Maintenance toggle)
- `admins` (Database-backed administrators)
- `admin_sessions` (Active login sessions)
- `users` (Customer accounts — email/WhatsApp + password)
- `user_sessions` (Customer login sessions)

---

### Step 4: Login & Enjoy!

Now open your deployed website, append `/admin` to the URL, and log in:

- **Username:** `MANAV`
- **Password:** `MANAV7412`

#### You can now:
- ✅ **Add / Edit / Delete Accounts & UC Packages** instantly from the panel.
- ✅ **Toggle Maintenance Mode** to show a global payment maintenance banner to all storefront visitors instantly.
- ✅ **Change your WhatsApp Support Number** in real-time under **Site controls** to instantly update every checkout page and chat link on the public site!
- ✅ **Add new admin team members** and assign them Roles (Owner / Admin / Moderator).
- ✅ **Change Passwords** directly under the **Team & Security** tab.
