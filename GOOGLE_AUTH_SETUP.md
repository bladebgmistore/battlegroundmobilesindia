# Custom Google Sign-In Setup

This Next.js App Router project uses its original **server-side Google OAuth 2.0
Authorization Code + PKCE** implementation. The Google profile is verified on
the server before the app issues its own signed session cookie.

## OAuth flow

1. `/login` and `/signup` display the same Google-only sign-in button in the
   site's dark gaming theme.
2. The button requests `/auth/google`. The route creates a CSRF `state` value
   and PKCE verifier, saves them with the safe return path in a short-lived,
   HTTP-only cookie, and redirects to Google.
3. Google returns to `/auth/google/callback`. The callback validates `state`,
   exchanges the authorization code using the PKCE verifier, fetches the Google
   profile, and requires a verified email.
4. The app upserts the account and issues a signed `bgmi_session` cookie.
5. The customer returns to the same-site `next` path supplied at sign-in.

Product discovery and the persistent cart are available while signed out.
Checkout and order creation require a signed-in account. Guests who click a
checkout action are redirected to `/login?next=<checkout-url>` and returned to
that checkout after Google sign-in.

## Google Cloud Console

1. Create or select an OAuth 2.0 **Web application** client in Google Cloud
   Console → APIs & Services → Credentials.
2. Configure the OAuth consent screen and publish it when ready for public
   sign-in (Testing mode allows only listed test users).
3. Add each exact callback URL to **Authorized redirect URIs**:
   - `https://battlegroundmobilesindia.shop/auth/google/callback`
   - `http://localhost:3000/auth/google/callback` for local development
   - Add preview or alternate production hosts when needed.
4. Use the `openid`, `email`, and `profile` scopes. The implementation requests
   only those standard profile scopes.

## Environment variables

Copy `.env.example` to `.env.local`, then set these values locally and in each
hosting environment:

```dotenv
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REDIRECT_URI=https://battlegroundmobilesindia.shop/auth/google/callback
AUTH_SECRET=replace-with-a-long-random-string
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
OWNER_EMAIL=manavjeph800@gmail.com
```

Generate a unique `AUTH_SECRET` with `openssl rand -base64 32`. Keep it stable
between deployments; changing it signs out existing sessions. `GOOGLE_REDIRECT_URI`
must match an Authorized redirect URI exactly. When it is omitted, local and
preview environments use the request origin plus `/auth/google/callback`.

## Deployment checklist

- Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`,
  `AUTH_SECRET`, `DATABASE_URL`, and `OWNER_EMAIL` in the hosting dashboard.
- Confirm the registered redirect URI matches `/api/auth/config-check`'s
  `effectiveRedirectUri` value.
- Open `/login` and complete a Google sign-in.
- As a guest, add an item to the cart and click checkout. Sign in and confirm
  you return to the same product or cart checkout.

The public `/api/auth/config-check` endpoint reports whether the required OAuth
and database configuration exists. It never returns the Google client secret.

## Security notes

- OAuth uses a short-lived, HTTP-only `state`/PKCE cookie; authorization-code
  exchange and profile retrieval happen server-side.
- Session cookies are HTTP-only, `SameSite=Lax`, signed with HMAC-SHA256, and
  expire after 30 days.
- Return paths are restricted to same-origin relative URLs to prevent open
  redirects.
- Keep `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, and `DATABASE_URL` server-only.
