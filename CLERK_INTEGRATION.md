# Clerk Authentication Integration — Battleground Mobile India Store

This document describes the complete replacement of the old custom Google OAuth system with **Clerk Authentication** for zero-hassle login, compulsory site protection, owner admin access, and visitor tracking.

---

## 1. Environment Variables (Vercel / .env.local)

Add these to **Vercel → Settings → Environment Variables** and to your local `.env.local`:

```env
# Clerk LIVE keys for battlegroundmobilesindia.shop
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_PUBLISHABLE_KEY
CLERK_SECRET_KEY=sk_live_YOUR_SECRET_KEY

# Optional but recommended (explicit URLs)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Owner / Admin
OWNER_EMAIL=manavjeph800@gmail.com

# Database (existing)
DATABASE_URL=postgresql://...
```

**Vercel Deployment Steps:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` with the live values above
3. Add `OWNER_EMAIL=manavjeph800@gmail.com`
4. Redeploy

---

## 2. Clerk Setup & Providers

### Install
```bash
npm install @clerk/nextjs
```

### Root Layout — `src/app/layout.tsx`

Wrap entire app with `<ClerkProvider>`:

```tsx
import { ClerkProvider } from "@clerk/nextjs";
import { SettingsProvider } from "@/components/settings-provider";
import VisitTracker from "@/components/visit-tracker";

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }) {
  const { values } = await getPublicSettings();

  return (
    <ClerkProvider
      appearance={{
        variables: { colorPrimary: "#0f4c81" },
        elements: {
          formButtonPrimary: "bg-[#0f4c81] hover:bg-[#0a3557] text-white",
          card: "shadow-xl border border-[#e3e9f2]",
        },
      }}
    >
      <html lang="en">
        <body>
          <SettingsProvider value={values}>{children}</SettingsProvider>
          <Suspense fallback={null}><VisitTracker /></Suspense>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

**Key Changes:**
- Removed old Google OAuth scripts
- Added `ClerkProvider` with custom branding matching store colors (#0f4c81)
- `metadataBase` updated to `https://battlegroundmobilesindia.shop`

---

## 3. Middleware — Compulsory Authentication

### Next.js 16 uses `proxy.ts` (formerly `middleware.ts`)

**File: `src/proxy.ts`** (and root `middleware.ts` for older Next.js compatibility — but Next 16 requires only `proxy.ts`)

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect(); // Redirect unauthenticated users to Clerk sign-in
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

**What this does:**
- **Compulsory auth across entire site** — no page viewable without login
- Unauthenticated users auto-redirect to `/sign-in` (Clerk's hosted UI)
- Only `/sign-in`, `/sign-up`, and webhooks are public
- Replaces old `bgmi_session` cookie check + `isPublicPath` logic

**For `middleware.ts` (if using Next.js 15 or docs reference):**
Same code as above, but file named `middleware.ts` at project root. Next.js 16 renamed it to `proxy.ts` — use `proxy.ts` only to avoid duplicate middleware error.

---

## 4. Sign-In / Sign-Up Components

### `src/app/sign-in/[[...sign-in]]/page.tsx`

```tsx
import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#eef1f6] px-5 py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-[11px] font-black tracking-[.22em] text-[#0f4c81]">BATTLEGROUNDS MOBILE INDIA STORE</p>
          <h1 className="mt-2 text-2xl font-black">Welcome back</h1>
        </div>
        <SignIn
          appearance={{
            variables: { colorPrimary: "#0f4c81" },
            elements: {
              formButtonPrimary: "bg-[#0f4c81] hover:bg-[#0a3557] text-white font-bold",
              card: "shadow-xl border border-[#e3e9f2] rounded-2xl",
            },
          }}
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/dashboard"
          forceRedirectUrl="/dashboard"
        />
        <p className="mt-6 text-center text-[11px] text-[#94a3b8]">
          Owner access: <span className="font-mono font-bold text-[#0f4c81]">manavjeph800@gmail.com</span> → Admin Panel
        </p>
      </div>
    </main>
  );
}
```

### `src/app/sign-up/[[...sign-up]]/page.tsx`

Same structure with `<SignUp>` component:

```tsx
import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#eef1f6] px-5 py-16">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/dashboard"
        forceRedirectUrl="/dashboard"
      />
    </main>
  );
}
```

**Clerk Dashboard Configuration for Login Methods:**

1. Go to https://dashboard.clerk.com → Your App (battlegroundmobilesindia.shop)
2. **User & Authentication → Social Connections:** Enable **Google** (add OAuth credentials)
3. **Email, Phone, Usernames:** 
   - Enable **Email address** → Enable **Email code (OTP)** and **Magic Link**
   - Enable **Phone number** → Enable **SMS code (OTP)**
4. **Paths:** Set Sign-in URL `/sign-in`, Sign-up URL `/sign-up`, After sign-in `/dashboard`
5. Save

The `<SignIn>` component automatically shows all enabled methods (Google button, Email OTP, Phone OTP).

---

## 5. Owner / Admin Access Control

**File: `src/lib/clerk-auth.ts`**

```ts
export const OWNER_EMAIL = "manavjeph800@gmail.com";

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (normalized === OWNER_EMAIL.toLowerCase()) return true;
  return OWNER_EMAILS.includes(normalized); // from env
}

export async function getClerkSession() {
  const { userId } = await auth();
  const user = await currentUser();
  const email = user.emailAddresses[0]?.emailAddress?.toLowerCase();
  const role = await resolveLoginRole(email); // checks staff_members table
  return { userId, email, name: user.fullName, picture: user.imageUrl, role };
}

export async function requireAdminArea() {
  const session = await getClerkSession();
  if (!isAdminAreaRole(session.role)) redirect("/dashboard?error=forbidden");
  const effectiveRole = await effectiveRoleForEmail(session.email, session.role);
  if (!isAdminAreaRole(effectiveRole)) redirect("/dashboard?error=forbidden");
  return { ...session, role: effectiveRole };
}
```

**Admin Page Guard — `src/app/admin/page.tsx`:**

```tsx
import { requireAdminArea } from "@/lib/clerk-auth";

export default async function Page() {
  const session = await requireAdminArea(); // Checks manavjeph800@gmail.com + staff table
  return <AdminDashboard owner={{ name: session.name, email: session.email, role: session.role, picture: session.picture }} />;
}
```

- `manavjeph800@gmail.com` always gets `owner` role (full access to `/admin`)
- Additional staff (admin/manager/moderator) managed from **Admin → Team & Roles** (stored in `staff_members` table)
- Role re-resolved on every request for instant revoke

---

## 6. Visitor Traffic Tracking (Admin Feature)

**Preserved and upgraded to Clerk:**

### `src/app/api/track/route.ts`

```ts
import { auth, currentUser } from "@clerk/nextjs/server";
import { recordVisit } from "@/lib/site-logs";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userId } = await auth();
  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress?.toLowerCase() ?? null;
  
  await recordVisit({
    userId: null, // clerk id not uuid, store null, use email as identity
    userEmail: email,
    userName: user?.fullName ?? "Guest",
    ipAddress: getClientIp(request),
    pageUrl: body.path,
    referrer: body.referrer,
    userAgent: request.headers.get("user-agent"),
    country: request.headers.get("x-vercel-ip-country"),
    city: request.headers.get("x-vercel-ip-city"),
  });
  
  return NextResponse.json({ ok: true });
}
```

### `src/components/visit-tracker.tsx`

Client beacon fires on every route change (except `/sign-in`, `/sign-up`, `/auth/*`), POSTs to `/api/track`.

### Database — `site_logs` table

Already exists in `src/db/schema.ts`:

```ts
export const siteLogs = pgTable("site_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userEmail: varchar("user_email", { length: 180 }),
  ipAddress: varchar("ip_address", { length: 64 }),
  pageUrl: text("page_url").notNull(),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  country: varchar("country", { length: 120 }),
  city: varchar("city", { length: 120 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### Admin Display — `src/components/admin-visitor-logs.tsx`

Shows in **Admin → Visitor Logs**:
- Total views, today, unique users
- Top pages
- Table: # | User | Email | IP | Page URL | Device | Timestamp
- Filters by email/path, auto-refresh 15s, CSV export, purge 30d+

---

## 7. Other Backend Updates

### `src/app/api/auth/session/route.ts` — now Clerk-powered

```ts
import { auth, currentUser } from "@clerk/nextjs/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ authenticated: false, user: null });
  const user = await currentUser();
  const email = user.emailAddresses[0]?.emailAddress?.toLowerCase();
  const role = await effectiveRoleForEmail(email, await resolveLoginRole(email));
  return NextResponse.json({
    authenticated: true,
    user: { id: userId, name: user.fullName, email, picture: user.imageUrl, role, isOwner: role === "owner", adminAccess: isAdminAreaRole(role) },
  });
}
```

### `src/lib/user-store.ts` — Clerk session

`getCurrentUser()` now uses `getClerkSession()` instead of `verifySession(cookie)`.

### `src/components/user-nav.tsx` — Clerk UI

- Uses `useUser()` from `@clerk/nextjs`
- Shows `SignInButton` when signed out, `UserButton` dropdown when signed in
- Role badge from `/api/auth/session`
- Mobile menu uses `SignOutButton`

### `src/components/user-dashboard.tsx`

- Uses `SignOutButton` for sign-out
- Shows `SIGNED IN WITH CLERK` badge
- Owner banner for `manavjeph800@gmail.com`

### Legacy Routes

- `/login` → redirects to `/sign-in`
- `/auth/google` and `/auth/google/callback` → redirect to `/sign-in`
- `/auth/logout` → redirects to `/sign-in` (Clerk's `<SignOutButton>` handles actual logout)

---

## 8. Testing Checklist

- [ ] Visit `/` while signed out → redirects to `/sign-in`
- [ ] Sign in with Google → lands on `/dashboard`
- [ ] Sign in with Email OTP → works (if enabled in Clerk dashboard)
- [ ] Sign in with Phone OTP → works (if enabled)
- [ ] Sign in as `manavjeph800@gmail.com` → `/admin` accessible, shows Owner badge
- [ ] Sign in as regular user → `/admin` redirects to `/dashboard?error=forbidden`
- [ ] Browse pages → check Admin → Visitor Logs → see email, IP, URL, timestamp logged
- [ ] `/api/auth/session` returns Clerk user with role
- [ ] Build passes: `npm run build`

---

## 9. Summary

- ✅ `@clerk/nextjs` installed
- ✅ `<ClerkProvider>` in root layout
- ✅ `src/proxy.ts` (Next.js 16 middleware) enforces compulsory auth via `auth.protect()`
- ✅ `/sign-in` and `/sign-up` pages with Clerk's `<SignIn>` / `<SignUp>` supporting Google, Email OTP/Magic Link, Phone OTP
- ✅ Owner check for `manavjeph800@gmail.com` → direct `/admin` access
- ✅ Visitor tracking logs email, IP, URL, timestamp into `site_logs` and displays in admin panel
- ✅ All old custom session code replaced but kept as compatibility layer in `src/lib/auth.ts`
- ✅ Build passes, typecheck passes

**Deployment:** Add Clerk env vars to Vercel and redeploy. Enable login methods in Clerk Dashboard.

