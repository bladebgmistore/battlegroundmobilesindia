/**
 * Shopping-cart store — framework-agnostic, `localStorage`-backed.
 *
 * The cart lives OUTSIDE React and is consumed through
 * `useSyncExternalStore` (see `src/components/cart-provider.tsx`), which gives
 * us, for free:
 *   • correct SSR — the server snapshot is always "empty cart", so the
 *     streamed HTML and the first client render agree (no hydration warning);
 *   • no cascading renders — the persisted cart is adopted during
 *     `subscribe()`, not by calling `setState` inside an effect;
 *   • live multi-tab sync through the `storage` event;
 *   • the same API for any non-React caller (analytics, tests…).
 *
 * Persistence is defensive: a corrupted, tampered or oversized payload is
 * sanitised line-by-line and never throws into the render tree.
 */

export const CART_STORAGE_KEY = "bgmi-cart-v1";

/** Hard ceilings so a corrupted payload can never freeze the UI. */
export const CART_MAX_LINES = 50;
export const CART_MAX_QUANTITY = 99;

export type CartItem = {
  /** Product id (falls back to a slug of the title). */
  id: string;
  title: string;
  /** Unit price in INR — always the payable (post-discount) price. */
  price: number;
  image?: string | null;
  /** Category slug — drives UID requirements and admin analytics. */
  categorySlug?: string | null;
  quantity: number;
};

/** What a product card hands to `addItem()`. */
export type CartInput = {
  id?: string;
  title: string;
  price: number;
  image?: string | null;
  categorySlug?: string | null;
  quantity?: number;
};

export type CartSnapshot = {
  items: CartItem[];
  /** Id of the most recently added line — drives the "ADDED ✓" flash. */
  lastAddedId: string | null;
  /** True once `localStorage` has been read on the client. */
  hydrated: boolean;
};

/** Stable snapshot used by the server render and by React's hydration pass. */
const EMPTY_SNAPSHOT: CartSnapshot = Object.freeze({ items: [], lastAddedId: null, hydrated: false });

let snapshot: CartSnapshot = EMPTY_SNAPSHOT;
let hydrated = false;
let storageBound = false;
let flashTimer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<() => void>();

/* ─────────────────────────── helpers ─────────────────────────── */

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "item";

/**
 * Stable cart line id: the product id when available, otherwise a slug of the
 * title. Exported so product cards can compare against `lastAddedId`.
 */
export function cartLineId(id: string | null | undefined, title: string): string {
  const clean = typeof id === "string" ? id.trim() : "";
  return clean ? clean.slice(0, 120) : slugify(title);
}

/** Coerce anything from storage/props into a safe cart line. */
function sanitizeItem(raw: unknown): CartItem | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<CartItem>;
  const title = typeof value.title === "string" ? value.title.trim().slice(0, 180) : "";
  const price = Number(value.price);
  if (!title || !Number.isFinite(price) || price <= 0) return null;

  const rawQuantity = Number(value.quantity ?? 1);
  const quantity = Number.isFinite(rawQuantity)
    ? Math.min(CART_MAX_QUANTITY, Math.max(1, Math.round(rawQuantity)))
    : 1;

  return {
    id: cartLineId(value.id, title),
    title,
    price: Math.round(price),
    image: typeof value.image === "string" && value.image.trim() ? value.image.trim() : null,
    categorySlug:
      typeof value.categorySlug === "string" && value.categorySlug.trim() ? value.categorySlug.trim().slice(0, 48) : null,
    quantity,
  };
}

function parseStoredCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : (parsed as { items?: unknown } | null)?.items;
    if (!Array.isArray(list)) return [];
    return list
      .map(sanitizeItem)
      .filter((item): item is CartItem => Boolean(item))
      .slice(0, CART_MAX_LINES);
  } catch {
    return [];
  }
}

function readStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY));
  } catch {
    // Storage blocked (Safari private mode) — treat as an empty cart.
    return [];
  }
}

function writeStorage(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    if (items.length) window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    else window.localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    // Quota exceeded / blocked — the in-memory cart keeps working.
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

/** Replace the snapshot (only when something actually changed) and notify. */
function setItems(next: CartItem[], options: { persist?: boolean } = {}): void {
  if (options.persist !== false) writeStorage(next);
  snapshot = { ...snapshot, items: next, hydrated: true };
  emit();
}

function flash(lastAddedId: string | null): void {
  if (flashTimer) clearTimeout(flashTimer);
  snapshot = { ...snapshot, lastAddedId, hydrated: true };
  emit();
  if (lastAddedId) {
    flashTimer = setTimeout(() => {
      flashTimer = null;
      snapshot = { ...snapshot, lastAddedId: null };
      emit();
    }, 1800);
  }
}

/** Read the persisted cart once, then keep an eye on other tabs. */
function bindStorage(): void {
  if (storageBound || typeof window === "undefined") return;
  storageBound = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== CART_STORAGE_KEY) return;
    hydrated = true;
    const items = parseStoredCart(event.newValue);
    snapshot = { ...snapshot, items, hydrated: true };
    emit();
  });
}

/* ─────────────────── public store API (useSyncExternalStore) ─────────────────── */

/** Subscribe to cart changes. Also performs the one-time hydration. */
export function subscribeCart(listener: () => void): () => void {
  listeners.add(listener);
  bindStorage();
  if (!hydrated) {
    hydrated = true;
    const items = readStorage();
    if (items.length) {
      snapshot = { ...snapshot, items, hydrated: true };
      emit();
    } else {
      snapshot = { ...EMPTY_SNAPSHOT, hydrated: true };
      emit();
    }
  }
  return () => {
    listeners.delete(listener);
  };
}

/** Client snapshot — reference-stable until the cart actually changes. */
export function getCartSnapshot(): CartSnapshot {
  return snapshot;
}

/** Server / hydration snapshot — always the empty cart. */
export function getServerCartSnapshot(): CartSnapshot {
  return EMPTY_SNAPSHOT;
}

/* ─────────────────────────── mutations ─────────────────────────── */

export function addCartItem(input: CartInput, options: { quantity?: number } = {}): CartItem | null {
  const quantity = options.quantity ?? input.quantity ?? 1;
  const item = sanitizeItem({ ...input, quantity });
  if (!item) return null;

  const current = snapshot.items;
  const index = current.findIndex((line) => line.id === item.id);

  if (index === -1) {
    if (current.length >= CART_MAX_LINES) return null;
    setItems([...current, item]);
  } else {
    const next = [...current];
    next[index] = {
      ...next[index],
      // Refresh the stored product snapshot (prices may have changed).
      title: item.title,
      price: item.price,
      image: item.image ?? next[index].image,
      categorySlug: item.categorySlug ?? next[index].categorySlug,
      quantity: Math.min(CART_MAX_QUANTITY, next[index].quantity + item.quantity),
    };
    setItems(next);
  }

  flash(item.id);
  return item;
}

export function removeCartItem(id: string): void {
  setItems(snapshot.items.filter((item) => item.id !== id));
}

export function setCartQuantity(id: string, quantity: number): void {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    removeCartItem(id);
    return;
  }
  setItems(
    snapshot.items.map((item) =>
      item.id === id ? { ...item, quantity: Math.min(CART_MAX_QUANTITY, Math.max(1, Math.round(quantity))) } : item,
    ),
  );
}

/** +1 / -1 (removing the line when the quantity would reach zero). */
export function adjustCartQuantity(id: string, delta: number): void {
  const line = snapshot.items.find((item) => item.id === id);
  if (!line) return;
  setCartQuantity(id, line.quantity + delta);
}

export function clearCart(): void {
  flash(null);
  setItems([]);
}

/* ─────────────────────────── derived values ─────────────────────────── */

export function cartCount(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
}
