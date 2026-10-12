/**
 * Meta (Facebook) Pixel — browser-side event helpers.
 *
 * The Pixel ID comes from `NEXT_PUBLIC_FACEBOOK_PIXEL_ID`, so the same code
 * runs in local dev, preview and production with no code changes. The base
 * snippet itself lives in `src/components/meta-pixel.tsx`, which is mounted
 * once from `src/app/layout.tsx`.
 *
 * Everything in this file is SSR-safe:
 * `window.fbq` only exists after the base code has been injected in the
 * browser, so every helper silently no-ops on the server (and when the pixel
 * is not configured / not loaded yet) instead of throwing.
 *
 * Usage:
 *   import { viewContent, addToCart, purchase } from "@/lib/fpixel";
 *   viewContent({ id: product.id, name: product.title, price: product.price });
 */

/** Pixel ID configured for this deployment (empty string when unset). */
export const FACEBOOK_PIXEL_ID = (process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID ?? "").trim();

/** True when `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` is configured. */
export const FACEBOOK_PIXEL_ENABLED = FACEBOOK_PIXEL_ID.length > 0;

/** Every price in this store is quoted in Indian Rupees. */
export const DEFAULT_CURRENCY = "INR";

/** Verbose logging in dev only — never in production builds. */
const DEBUG = process.env.NODE_ENV !== "production";

/* -------------------------------------------------------------------------- */
/*  Types + window augmentation                                               */
/* -------------------------------------------------------------------------- */

/** Loose parameter bag accepted by the Meta Pixel. */
export type FbqParameters = Record<string, unknown>;

/** Shape of the `fbq` stub/function created by the Meta Pixel base code. */
export interface FbqFunction {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  loaded?: boolean;
  version?: string;
  queue?: unknown[][];
  push?: (...args: unknown[]) => void;
}

declare global {
  interface Window {
    /** Global command queue installed by the Meta Pixel base code. */
    fbq?: FbqFunction;
    /** Legacy alias — also set by the base code. */
    _fbq?: FbqFunction;
  }
}

/** A catalogue item that the store can report to Meta. */
export type MetaItem = {
  /** Stable product id (database id, slug or SKU). */
  id: string;
  /** Product title shown to the customer. */
  name?: string;
  /** Unit price in INR. */
  price?: number;
  /** Defaults to 1. */
  quantity?: number;
  /** Category slug, e.g. "accounts" | "uc" | "x-suits". */
  category?: string;
};

export type TrackOptions = {
  /**
   * Same value on the browser Pixel and the Conversions API request so Meta
   * deduplicates the two — only needed once you add server-side tracking.
   */
  eventID?: string;
  /** Extra standard / custom parameters merged into the payload. */
  params?: FbqParameters;
};

export type CheckoutDetails = {
  items: MetaItem[];
  /** Coupon-adjusted total actually payable. Defaults to the sum of items. */
  value?: number;
  currency?: string;
};

export type PurchaseDetails = {
  /** Store order reference (e.g. `BG-LX8K2-482`) — sent as `order_id`. */
  orderId?: string;
  /** Amount actually charged, coupon adjusted. */
  value: number;
  /** Defaults to "INR". */
  currency?: string;
  items?: MetaItem[];
  contentName?: string;
  contentCategory?: string;
  /** Payment channel used, e.g. "upi" | "whatsapp". */
  paymentMethod?: string;
};

/* -------------------------------------------------------------------------- */
/*  Internals                                                                 */
/* -------------------------------------------------------------------------- */

/** The live `fbq` function, or null on the server / before the pixel loads. */
function getFbq(): FbqFunction | null {
  if (typeof window === "undefined") return null;
  const { fbq } = window;
  return typeof fbq === "function" ? fbq : null;
}

/** True once the base code has run and `window.fbq` is callable. */
export function isPixelReady(): boolean {
  return getFbq() !== null;
}

/** Low-level `fbq(...)` call with SSR + error guards. `event()` uses this. */
function fbqCommand(...args: unknown[]): void {
  const instance = getFbq();
  if (!instance) {
    if (DEBUG) console.debug("[Meta Pixel] skipped (pixel not loaded):", args);
    return;
  }
  try {
    instance(...args);
  } catch (error) {
    console.warn("[Meta Pixel] command failed:", error);
  }
}

function toItems(items: MetaItem | MetaItem[]): MetaItem[] {
  return Array.isArray(items) ? items : [items];
}

/** Builds the standard `content_ids` / `contents` / `value` parameter block. */
function contentPayload(items: MetaItem[], currency: string = DEFAULT_CURRENCY): FbqParameters {
  const contents = items.map((item) => ({
    id: item.id,
    quantity: item.quantity ?? 1,
    ...(typeof item.price === "number" ? { item_price: item.price } : {}),
  }));

  const payload: FbqParameters = {
    content_ids: items.map((item) => item.id),
    content_type: "product",
    contents,
    num_items: contents.reduce((sum, entry) => sum + entry.quantity, 0),
  };

  if (items.length === 1) {
    const [item] = items;
    if (item.name) payload.content_name = item.name;
    if (item.category) payload.content_category = item.category;
  }

  const value = contents.reduce((sum, entry) => sum + (entry.item_price ?? 0) * entry.quantity, 0);
  if (value > 0) {
    payload.value = value;
    payload.currency = currency;
  }

  return payload;
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Track any standard or custom Meta event.
 *
 * @example event("Lead", { value: 199, currency: "INR" });
 */
export function event(name: string, parameters: FbqParameters = {}, options: TrackOptions = {}): void {
  const payload: FbqParameters = { ...parameters, ...options.params };
  fbqCommand("track", name, payload, options.eventID ? { eventID: options.eventID } : undefined);
  if (DEBUG) console.debug(`[Meta Pixel] track ${name}`, payload);
}

/**
 * Manually send a PageView. The base code + `<MetaPixel />` already fire one on
 * load and on every App-Router route change — call this only for special cases
 * (e.g. a modal that acts like a new "page").
 */
export function pageview(options: TrackOptions = {}): void {
  event("PageView", {}, options);
}

/** Fired when a product/listing detail view is opened. */
export function viewContent(items: MetaItem | MetaItem[], options: TrackOptions = {}): void {
  event("ViewContent", contentPayload(toItems(items)), options);
}

/**
 * Fired when the customer commits to a product (here: taps the store's
 * CHECKOUT button on a listing).
 */
export function addToCart(items: MetaItem | MetaItem[], options: TrackOptions = {}): void {
  event("AddToCart", contentPayload(toItems(items)), options);
}

/** Fired when the customer starts the checkout/payment flow. */
export function initiateCheckout(details: CheckoutDetails, options: TrackOptions = {}): void {
  const currency = details.currency ?? DEFAULT_CURRENCY;
  const payload = contentPayload(details.items, currency);
  if (typeof details.value === "number") {
    payload.value = details.value;
    payload.currency = currency;
  }
  event("InitiateCheckout", payload, options);
}

/**
 * Fired after the customer pays.
 *
 * In this store the payment is confirmed by the buyer ("I have paid" +
 * UPI screenshot), so `purchase()` is called from `/payment` right after the
 * order is marked as paid. Amount is always the coupon-adjusted INR total.
 */
export function purchase(details: PurchaseDetails, options: TrackOptions = {}): void {
  const currency = details.currency ?? DEFAULT_CURRENCY;
  const payload: FbqParameters = {};

  if (details.orderId) payload.order_id = details.orderId;

  const items = details.items?.length ? details.items : [];
  if (items.length) Object.assign(payload, contentPayload(items, currency));

  // Explicit values win over the computed ones, so the reported revenue always
  // matches what the customer actually paid.
  payload.value = details.value;
  payload.currency = currency;
  if (details.contentName) payload.content_name = details.contentName;
  if (details.contentCategory) payload.content_category = details.contentCategory;
  if (details.paymentMethod) payload.payment_method = details.paymentMethod;

  event("Purchase", payload, options);
}
