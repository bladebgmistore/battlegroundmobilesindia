# Meta (Facebook) Pixel Setup — Battleground India Store

Pixel ID: **`4056208531176598`** (domain: `battlegroundmobilesindia.shop`)
Stack: **Next.js 16 · App Router · React 19 · TypeScript**

The pixel is driven entirely by one environment variable:

```bash
NEXT_PUBLIC_FACEBOOK_PIXEL_ID=4056208531176598
```

Isse pehle kuch bhi hard-coded nahi hai — blank kar do to pixel us environment
mein load hi nahi hoga (koi console error nahi aayega).

---

## 1. File placement (exact paths)

| File | Status | Kya karta hai |
|---|---|---|
| `src/lib/fpixel.ts` | **NEW** | Event helpers + `window.fbq` TypeScript types. Saare SSR-safe. |
| `src/components/meta-pixel.tsx` | **NEW** | Base code (`next/script`) + `<noscript>` fallback + route-change PageView. |
| `src/app/layout.tsx` | edited | `<MetaPixel />` ko `<Suspense>` ke andar mount karta hai (body ke top par). |
| `src/components/checkout-page.tsx` | edited | `ViewContent` (page load) + `InitiateCheckout` (order create hone par). |
| `src/components/payment-page.tsx` | edited | `Purchase` (UPI "I Have Paid" + screenshot confirm hone par). |
| `src/components/home-page.tsx` | edited | `AddToCart` — `BuyButton` / `UcBuyButton` click par. |
| `src/components/accounts-page.tsx` | edited | `ViewContent` (quick view modal) + `AddToCart` (checkout click). |
| `src/components/special-category-page.tsx` | edited | `AddToCart` — X-Suits / Super Cars buy click. |
| `src/components/uc-page.tsx` | edited | `AddToCart` — UC pack buy click. |
| `.env.example` | edited | Naya env var documented. |
| `.env.local` | created (git-ignored) | Local dev ke liye pixel ID. |

> File names repo ki existing convention (kebab-case) follow karte hain —
> `meta-pixel.tsx` = `MetaPixel` component, `fpixel.ts` = pixel utilities.

---

## 2. Environment variable

### Local dev

`.env.local` (already created, git-ignored):

```bash
NEXT_PUBLIC_FACEBOOK_PIXEL_ID=4056208531176598
```

### Vercel

Project → **Settings → Environment Variables** → add
`NEXT_PUBLIC_FACEBOOK_PIXEL_ID` = `4056208531176598` for **Production + Preview + Development** → **Redeploy**.

### Netlify

Site configuration → **Environment variables** → same key/value → **Deploys → Trigger deploy → Clear cache and deploy site**.

> ⚠️ `NEXT_PUBLIC_*` values **build time** par bundle mein inline ho jati hain.
> Env var add karne ke baad redeploy karna zaroori hai, warna purane bundle mein
> value nahi hogi. (Ye value public hai — browser bundle mein dikhti hai, isliye
> ise secret mat samjho.)

---

## 3. What fires where

| Event | Trigger in this store | Key parameters |
|---|---|---|
| `PageView` | Har document load (base code) **+** har client-side route change (`usePathname`/`useSearchParams` effect) **+** `<noscript>` </br>fallback | — |
| `ViewContent` | `/checkout` page load (product + price known), aur `/accounts` ka **Quick View** modal | `content_ids`, `content_name`, `content_category`, `value`, `currency: "INR"` |
| `AddToCart` | Listing ke **CHECKOUT** button par click (home, accounts, UC, X-Suits, Super Cars) | `content_ids`, `contents`, `value`, `currency` |
| `InitiateCheckout` | `/api/orders` se order ban jane ke baad (payment step start) | same as above + `order_id` (store ka `BG-XXXX` code) |
| `Purchase` | `/payment` par **I Have Paid** (UPI screenshot confirm) | `order_id`, `value`, `currency: "INR"`, `contents`, `payment_method: "upi"` |

Double counting se bacha gaya hai: base code ka pehla `PageView` hi landing ka
PageView hai, hook sirf **baad ke** navigations track karta hai.

> `content_ids` mein listing pages par **product id** (DB id / slug) jata hai.
> `/checkout` aur `/payment` par sirf product ka naam available hota hai, isliye
> wahan `content_ids` = product title hai. Agar aap Meta catalog (Advantage+
> shopping) use karte ho, to checkout URL mein `&pid=<product-id>` pass karke
> `checkout-page.tsx` / `payment-page.tsx` mein wahi id bhej dena — baaki sab
> same rahega.

---

## 4. Using the helpers anywhere in the app

```tsx
import { addToCart, viewContent, initiateCheckout, purchase, event, pageview } from "@/lib/fpixel";

// Product detail view
viewContent({ id: "pharaoh-max", name: "Pharaoh Max Account", price: 4999, category: "accounts" });

// Buyer ne product pakda (cart me daala)
addToCart({ id: "pharaoh-max", name: "Pharaoh Max Account", price: 4999 });

// Checkout shuru — coupon-adjusted total bhejo
initiateCheckout({ items: [{ id: "pharaoh-max", price: 4499 }], value: 4499, currency: "INR" });

// Payment ho gaya — order details ke saath
purchase({
  orderId: "BG-LX8K2-482",
  value: 4499,
  currency: "INR",                       // default "INR" hai
  items: [{ id: "pharaoh-max", name: "Pharaoh Max Account", price: 4499 }],
  paymentMethod: "upi",
});

// Koi bhi standard / custom event
event("Lead", { value: 199, currency: "INR" });
event("Contact", { method: "whatsapp" });
pageview(); // manual PageView (SPA modals ke liye)
```

Har helper:

- `typeof window !== "undefined"` + `window.fbq` check karta hai → **SSR/prerender safe**.
- `try/catch` ke andar chalta hai → ad-blocker ya blocked script se site break nahi hoti.
- Dev mode mein console par payload log karta hai (`[Meta Pixel] track Purchase {...}`), production mein chup rehta hai.

### TypeScript safety

`src/lib/fpixel.ts` global `Window` interface ko augment karta hai:

```ts
declare global {
  interface Window {
    fbq?: FbqFunction;
    _fbq?: FbqFunction;
  }
}
```

Isliye kahin bhi `window.fbq(...)` likhne par `Property 'fbq' does not exist on
type 'Window'` ya `any` cast ki zarurat nahi padti — `tsc --noEmit` aur ESLint
dono clean rehte hain.

---

## 5. Testing

1. **Deploy / local dev** → chrome mein **Meta Pixel Helper** extension kholo.
2. Events Manager → **Test Events** → apna domain ka URL paste karo → site par
   `PageView → ViewContent → AddToCart → InitiateCheckout → Purchase` funnel
   replay karo; har event turant dikhega.
3. Manual check: DevTools → Network → `connect.facebook.net/en_US/fbevents.js`
   load hona chahiye, aur `/tr/` par PageView request.
4. `view-source:` mein `<noscript><img ... src="https://www.facebook.com/tr?id=4056208531176598&ev=PageView&noscript=1" /></noscript>` server-rendered HTML mein milta hai (JS off users ke liye fallback).

Useful debugging snippets (browser console):

```js
window.fbq && window.fbq('track', 'Lead');   // manual test event
window.fbq && window.fbq.getState             // (stub hai to undefined — normal)
```

---

## 6. Notes & next steps

- **Purchase timing:** payment isi store mein buyer ke "I Have Paid" + UPI
  screenshot se confirm hota hai, isliye `Purchase` browser se turant fire hota
  hai. Agar aap chahte ho ki revenue sirf admin verification ke baad count ho,
  to `purchase()` call ko admin approve flow par move kar do aur
  [Conversions API](https://developers.facebook.com/docs/marketing-api/conversions-api)
  (server-side, `eventID` dedup ke saath) use karo — `TrackOptions.eventID` isi
  ke liye already support karta hai.
- **Ad-blockers** kuch visitors ke browser mein `fbevents.js` block karte hain;
  helpers silently skip kar dete hain (koi error nahi).
- **Disable karna hai?** Env var blank karo (`NEXT_PUBLIC_FACEBOOK_PIXEL_ID=`),
  redeploy — component `null` return karega, koi tracking nahi.
- **Custom events** ke liye `event("MyEvent", {...})` hi kaafi hai; helpers
  chhote rakhe gaye hain taaki aap apne funnel ke hisaab se aasani se add/remove
  kar sako.
