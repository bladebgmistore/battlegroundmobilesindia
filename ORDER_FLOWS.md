# Order, OTP & Chat Flows

This document describes the four workflows added/changed in this build. Every
database change is **idempotent and applied automatically** on the first
request (`ensureOrderColumns()` / `ensurePresenceTable()`); the matching SQL is
in [`sql/008_order_otp_presence.sql`](./sql/008_order_otp_presence.sql) if you
prefer to run it explicitly.

---

## 1. New-user WhatsApp prompt & Profile cleanup

**Flow**

1. A brand-new Google account lands on the site after `/auth/google/callback`.
   The callback sets a short-lived `bgmi_new_account=1` cookie when the user row
   was just created (`upsertGoogleUser()` now returns `isNew`).
2. `components/whatsapp-prompt.tsx` (mounted in the root layout) sees the flag
   and immediately opens a modal asking for the buyer's **active WhatsApp
   number**, with a country-code picker (`+91`, `+971`, `+1`, … — see
   `lib/phone.ts`).
3. Saving PATCHes `/api/account/profile` → `users.whatsapp`.
4. Signed-in users without a saved number get the same prompt at most once a
   week (dismissal is remembered in `localStorage`). Staff on `/admin` are never
   prompted.

**Storage format:** E.164 with the leading `+`, e.g. `+919876543210`.
A bare 10-digit input is treated as Indian (`+91`). `users.whatsapp` is unique —
linking a number that belongs to another account returns a friendly error.

**Profile & Security**

* No dummy/masked data anywhere: the email is the verified Google address and
  the phone shows the real saved value (`+91 98765 43210`) or nothing.
* When no number is saved, the field is empty and the security card shows an
  **Add Phone Number** action instead of a placeholder.
* The saved number can be changed or removed from the same screen.

---

## 2. UC order flow

**Buyer**

* Checkout → payment page (`/payment?…&category=uc`). The buyer enters the
  **Transaction ID / UTR** and uploads the payment screenshot.
* Confirming calls `POST /api/orders/confirm-payment`
  `{ orderCode, markPaid: true, transactionId }`. The UTR is stored in
  `orders.transaction_ref`.
* The success modal reads:

  > **Your order has been confirmed successfully! Our team is processing it.**

  The buyer stays on the confirmation screen (no redirect to My Orders).
* **UC orders are never returned by `/api/account/orders`** — they cannot appear
  in the customer's personal order history.

**Admin → Operations → UC Orders** (`/api/admin/uc-orders`)

A dedicated desk lists every UC purchase with buyer name / WhatsApp / IP
location, **Player ID**, **character name**, **transaction ID + payment
receipt**, amount, and the order status (with one-click *Mark UC delivered*).
The list refreshes every 8s and has search + status filters.

---

## 3. Account purchase & random 6-digit OTP

**Generation (server only)** — `lib/otp.ts`

```ts
generateOtpCode(); // crypto.getRandomValues with rejection sampling
// → "482910"
```

Nobody types an OTP: not the customer, not the admin.

| Step | Who | Result |
| --- | --- | --- |
| Buyer confirms the purchase payment (`POST /api/orders/confirm-payment`, `markPaid`) | Buyer | First 6-digit OTP is **auto-generated** and stored on the order |
| Admin sets credentials and confirms the purchase (`PATCH /api/orders`, status `payment_confirmed`/`delivered`) | Admin | If no code exists yet, one is **auto-generated** (`otp_issued_at`, `otp_request_status = approved`) |
| Buyer opens My Orders | Buyer | Sees account ID + password **and** the active OTP |
| Buyer taps **Get New OTP** → `/verify?type=otp` → pays the refundable fee → *I have paid* | Buyer | `POST /api/orders/verify-payment` sets `otp_request_status = pending`, `otp_request_paid = true` — **no duplicate order row** |
| Admin opens **Account Orders** → **Approve request** | Admin | A brand-new random OTP is generated and shown to the buyer instantly (bell notification too) |
| Admin → **Reject** | Admin | Status `rejected`; the buyer can submit a fresh request |

**Admin → Operations → Account Orders** (`/api/admin/account-orders`)

Each purchase gets its own entry showing the account ID, password (masked with a
reveal toggle), **current active OTP**, **OTP request status**, **payment
confirmation status**, and the actions *Confirm payment*, *Mark delivered*,
*Edit credentials*, *Approve / New OTP*, *Reject*.

---

## 4. Chat read receipts & smart Telegram alerts

**Blue double ticks (admin only)** — `components/support-chat.tsx`

* `GET /api/admin/tickets/:id/messages` marks the customer's messages as read
  **before** listing them, so the payload already reflects `isRead: true`.
* The admin sees `✓✓` in **blue** once a message is seen, grey `✓✓` before that.
  The indicator is rendered only when `viewer === "admin"` — buyers never see it.

**Telegram (only for messages that stay unseen)** — `lib/support-alerts.ts`

1. If a staff member currently has the ticket open (presence heartbeat from the
   admin dashboard, `admin_presence` table) → **no alert**.
2. If no staff is online → alert immediately (nothing can have been seen).
3. If staff is online elsewhere → wait the threshold
   (`TELEGRAM_UNREAD_ALERT_DELAY_MS`, default **20 s**), then re-check:
   * message still unread and chat still closed → one alert
   * message read in the meantime → silence

Sends are scheduled with Next.js `after()`; a Telegram outage never blocks a
customer request.

New orders still notify the admin immediately (`notifyAdminNewOrder`) — only
**chat** messages use the unseen-based rule.

---

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | built-in demo bot | Telegram bot used for admin alerts |
| `ADMIN_CHAT_ID` | built-in demo chat | Where admin alerts are delivered |
| `TELEGRAM_UNREAD_ALERT_DELAY_MS` | `20000` | How long a chat message must stay unseen before alerting (5s–120s) |

---

## Quick verification checklist

1. Sign in with a **new** Google account → WhatsApp modal appears; save `+91 98765 43210` → shown in Profile & Security.
2. Buy a UC pack → payment page asks for the UTR → confirm → success message → the order is **absent** from My Orders but present under Admin → UC Orders.
3. Buy an account, confirm it in Admin → Account Orders → the buyer sees ID/password + a 6-digit OTP.
4. Buyer taps **Get New OTP** → pays → status becomes *pending* → admin **Approve** → a different 6-digit code appears for the buyer.
5. Send a chat message while the admin has the ticket open → no Telegram alert; close the chat and message again → Telegram arrives after the threshold.
