"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  addCartItem,
  adjustCartQuantity,
  cartCount,
  cartSubtotal,
  clearCart,
  getCartSnapshot,
  getServerCartSnapshot,
  removeCartItem,
  setCartQuantity,
  subscribeCart,
  type CartInput,
  type CartItem,
} from "@/lib/cart-store";
import { canonicalCategorySlug } from "@/lib/catalog";
import { addToCart as pixelAddToCart } from "@/lib/fpixel";
import { isUidRequiredProduct, mrpOf } from "@/lib/store-data";

/**
 * Store-wide shopping cart.
 *
 * The data lives in `src/lib/cart-store.ts` (an external, localStorage-backed
 * store consumed via `useSyncExternalStore`); this provider only adds the
 * React ergonomics: derived totals, the drawer's open/close UI state and the
 * "ADDED ✓" flash, plus a checkout URL builder that produces exactly the query
 * string the existing `/checkout` page and `/api/orders` route expect.
 */

export type { CartInput, CartItem } from "@/lib/cart-store";
export { CART_STORAGE_KEY, cartLineId } from "@/lib/cart-store";

export type CartContextValue = {
  items: CartItem[];
  /** Total units — what the navbar badge shows. */
  count: number;
  /** Distinct line items. */
  lines: number;
  /** Sum of `price × quantity`. */
  subtotal: number;
  /** Struck-out MRP minus subtotal (the site-wide promotional saving). */
  savings: number;
  /** True once the persisted cart has been read on the client. */
  isReady: boolean;
  isOpen: boolean;
  /** Id of the most recently added line — drives the "ADDED ✓" flash. */
  lastAddedId: string | null;
  addItem: (item: CartInput, options?: { open?: boolean; quantity?: number }) => void;
  removeItem: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  increment: (id: string) => void;
  decrement: (id: string) => void;
  clear: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  /** `/checkout?...` URL covering the whole cart. */
  buildCheckoutUrl: () => string;
  /** True when at least one line needs a BGMI Player UID. */
  requiresUid: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

/** Does this line require a BGMI Player UID at checkout? */
function lineRequiresUid(item: CartItem): boolean {
  const slug = canonicalCategorySlug(item.categorySlug ?? "");
  if (slug === "uc" || slug === "super-cars" || slug === "x-suits") return true;
  return isUidRequiredProduct(item.title);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { items, lastAddedId, hydrated } = useSyncExternalStore(
    subscribeCart,
    getCartSnapshot,
    getServerCartSnapshot,
  );
  const [isOpen, setIsOpen] = useState(false);

  const addItem = useCallback<CartContextValue["addItem"]>((item, options) => {
    const added = addCartItem(item, { quantity: options?.quantity });
    if (!added) return;

    // Meta Pixel: standard AddToCart event (no-ops when the pixel is absent).
    pixelAddToCart({
      id: added.id,
      name: added.title,
      price: added.price,
      quantity: options?.quantity ?? 1,
      category: added.categorySlug ?? undefined,
    });

    if (options?.open) setIsOpen(true);
  }, []);

  const increment = useCallback((id: string) => adjustCartQuantity(id, 1), []);
  const decrement = useCallback((id: string) => adjustCartQuantity(id, -1), []);
  const clear = useCallback(() => clearCart(), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const toggleCart = useCallback(() => setIsOpen((value) => !value), []);

  const count = useMemo(() => cartCount(items), [items]);
  const subtotal = useMemo(() => cartSubtotal(items), [items]);
  const savings = useMemo(
    () => items.reduce((total, item) => total + (mrpOf(item.price) - item.price) * item.quantity, 0),
    [items],
  );
  const requiresUid = useMemo(() => items.some(lineRequiresUid), [items]);

  const buildCheckoutUrl = useCallback(() => {
    if (!items.length) return "/checkout";

    const params = new URLSearchParams();
    // The order API stores a single product name per order: one line keeps the
    // real title, a multi-line cart gets a short, human summary. `cart=1` tells
    // the checkout page to list the line items and to empty the cart once the
    // order has been registered.
    const primary = items[0].title;
    const product =
      items.length === 1 ? primary : `${primary} + ${items.length - 1} more item${items.length > 2 ? "s" : ""}`;
    params.set("product", product.slice(0, 180));
    params.set("amount", String(subtotal));
    params.set("cart", "1");

    const canonicalSlugs = items.map((item) => canonicalCategorySlug(item.categorySlug ?? ""));
    const category =
      canonicalSlugs.every((slug) => slug === canonicalSlugs[0]) && canonicalSlugs[0] ? canonicalSlugs[0] : null;
    if (category) params.set("category", category);
    if (requiresUid) params.set("uid", "1");

    return `/checkout?${params.toString()}`;
  }, [items, requiresUid, subtotal]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count,
      lines: items.length,
      subtotal,
      savings,
      isReady: hydrated,
      isOpen,
      lastAddedId,
      addItem,
      removeItem: removeCartItem,
      setQuantity: setCartQuantity,
      increment,
      decrement,
      clear,
      openCart,
      closeCart,
      toggleCart,
      buildCheckoutUrl,
      requiresUid,
    }),
    [
      addItem,
      buildCheckoutUrl,
      clear,
      closeCart,
      count,
      decrement,
      hydrated,
      increment,
      isOpen,
      items,
      lastAddedId,
      openCart,
      requiresUid,
      savings,
      subtotal,
      toggleCart,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/**
 * Access the cart. Must be called from a client component rendered inside the
 * root `<CartProvider>` (mounted in `src/app/layout.tsx`); anything else is a
 * programming error and surfaces immediately in development.
 */
export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside <CartProvider> (see src/app/layout.tsx)");
  return context;
}

/** Convenience selector — just the badge count. */
export function useCartCount(): number {
  return useCart().count;
}
