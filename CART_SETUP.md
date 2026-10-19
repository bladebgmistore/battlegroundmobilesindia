# Shopping Cart — slide-over drawer, live navbar badge, localStorage persistence

A production-ready cart built on **React Context + `useSyncExternalStore`** with
the data persisted in `localStorage`. No extra dependency was added.

```
src/lib/cart-store.ts          ← the store (pure, framework-agnostic, localStorage)
src/components/cart-provider.tsx ← <CartProvider> + useCart() hook (totals, drawer state, checkout URL)
src/components/cart-drawer.tsx   ← slide-over drawer (quantities, remove, totals)
src/components/cart-button.tsx   ← navbar icon + live badge
src/components/add-to-cart-button.tsx ← "ADD TO CART" button used on product cards
```

`<CartProvider>` and `<CartDrawer />` are mounted once in `src/app/layout.tsx`, so
the badge, the drawer and every product card stay in sync on every page.

---

## Features

- **Live badge** — the header cart icon shows the total number of *units* in the
  cart. It mounts outside the `hidden sm:flex` group, so it is reachable on
  phones too. Badge animates on add (`99+` above 99).
- **Slide-over drawer** — springs in from the right over a blurred backdrop.
  Includes: line items with thumbnail + category, quantity −/+ steppers, remove,
  "you save" vs the struck-out MRP, total payable, *Clear cart*, and
  **Proceed to checkout**. Closes on backdrop click, ✕, or `Esc`; background
  scroll is locked while open.
- **Add to Cart buttons** on every product card: home page account/X-Suit/
  Super-Car shelves, UC package tiles, `/accounts` (grid + quick-view modal),
  `/uc-purchase`, and the category pages. Each flashes **ADDED ✓** for ~1.8s.
- **Persistence** — the cart survives reloads, restarts and even a
  logout/login, and stays in sync across tabs (`storage` event).
- **SSR-safe** — the server always renders an empty cart and the persisted cart
  is adopted during hydration via `useSyncExternalStore`, so there is no
  hydration mismatch and no cascading re-render.
- **Defensive** — a corrupted, tampered or oversized `localStorage` payload is
  sanitised line-by-line; ceilings are 50 lines × 99 units.
- **Meta Pixel** — every add fires the standard `AddToCart` event through
  `src/lib/fpixel.ts` (a no-op when the pixel is not configured).
- **Flexible quantity** — cart checkout is only one click from the drawer; the
  checkout page shows the line items for multi-item carts.

## Keyboard / a11y

| Control | Behaviour |
|---|---|
| Cart icon | `aria-label="Open cart, N items"`, `aria-expanded` |
| Drawer | `role="dialog"`, `aria-modal="true"`, focusable close button, `Esc` closes |
| Quantity buttons | labelled "Increase/Decrease quantity" |
| Remove | labelled `Remove <product>` |

---

## Using it in a component

```tsx
"use client";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { useCart } from "@/components/cart-provider";

// Drop-in button for any listing
<AddToCartButton
  item={{ id: product.id, title: product.title, price: product.price, image: product.image, categorySlug: "accounts" }}
  compact                       // dense padding for grids
  label="ADD TO CART"
  addedLabel="ADDED"
  openDrawer={false}            // true → open the drawer immediately
/>;

// Full control
const { items, count, subtotal, addItem, removeItem, setQuantity, clear, openCart, buildCheckoutUrl } = useCart();
addItem({ title: "16,200 UC Package", price: 1000, categorySlug: "uc" }, { open: true });
```

Outside React (analytics, tests, non-component modules):

```ts
import { addCartItem, getCartSnapshot, cartCount, cartSubtotal } from "@/lib/cart-store";
addCartItem({ id: "cars-1x", title: "1X SUPERCAR", price: 1999, categorySlug: "super-cars" });
cartCount(getCartSnapshot().items);
```

---

## Checkout integration

The drawer's **Proceed to checkout** sends the customer to the existing checkout
page — no new API, no duplicated pricing logic:

```
/checkout?product=<primary title / summary>&amount=<subtotal>&cart=1&category=<slug>&uid=1?
```

- `amount` is the live sum of `price × quantity`, so the price the customer saw
  in the drawer is the price the order API stores (`/api/orders`).
- `uid=1` is appended automatically when **any** line needs a BGMI Player UID
  (UC, Super Cars, X-Suits) — the checkout page then asks for and auto-verifies it.
- `cart=1` makes the checkout page list the cart line items and, once the order
  has been registered (HTTP 200/201), empty the cart automatically.
- Coupons, QR payment, WhatsApp handoff and order notifications are untouched.

Order summaries for multi-item carts are stored as
`"<first product> + N more items"` because `orders.product_name` is a single
column — the individual lines stay visible to the customer on the checkout page.

---

## Configuration & resetting

| Thing | Value |
|---|---|
| Storage key | `bgmi-cart-v1` (see `CART_STORAGE_KEY`) |
| Max lines / units per line | 50 / 99 (`CART_MAX_LINES`, `CART_MAX_QUANTITY`) |
| Cart is per-browser | it is **not** tied to the account; signing in/out keeps it |
| Clear a cart manually | `localStorage.removeItem("bgmi-cart-v1")`, or the drawer's *Clear cart* |

**Preview helper (optional):** with no `BGMISTORE_DATABASE_URL` the catalog is empty, so
the storefront has nothing to add to the cart. To demo the cart against the
built-in sample catalog, set `STORE_DEMO_CATALOG=1` (only honoured when
`NODE_ENV !== "production"` and only when the database read has failed — see
`src/app/api/store/route.ts`). It is off by default and can be deleted.
