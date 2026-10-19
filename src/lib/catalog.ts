/**
 * Catalog routing / visibility helpers — deliberately dependency-free so the
 * same rules run in server route handlers, the admin dashboard and the public
 * storefront.
 *
 * Why this file exists
 * ────────────────────
 * The store used to hard-code its header menu to four slugs
 * (`accounts`, `uc`, `super-cars`, `x-suits`). Any category an admin created
 * afterwards existed in the database but had no route in the navigation, and
 * the homepage linked custom categories to `#anchor` fragments instead of a
 * real page. Centralising the slug → URL mapping here means the admin panel,
 * the header, the footer, the homepage and the category route can never drift
 * apart again.
 */

import type { Category, Product, StorePage } from "@/lib/store-data";

/** Categories that have a purpose-built page instead of the generic route. */
export const CATEGORY_ROUTE_OVERRIDES: Record<string, string> = {
  accounts: "/accounts",
  uc: "/uc-purchase",
};

/**
 * Legacy / friendly slugs accepted by `/category/[slug]`.
 * The key is what a visitor may type, the value is the canonical DB slug.
 */
export const CATEGORY_SLUG_ALIASES: Record<string, string> = {
  // Legacy/manual imports often used singular or capitalised slugs
  // ("Account", "Supercar", "Xsuite"). Normalising them here keeps the
  // storefront, admin routing and product matching in agreement.
  account: "accounts",
  "premium-account": "accounts",
  "premium-accounts": "accounts",
  ucpackages: "uc",
  "uc-package": "uc",
  "uc-packages": "uc",
  "uc-purchase": "uc",
  ucs: "uc",
  "super-car": "super-cars",
  supercar: "super-cars",
  supercars: "super-cars",
  "x-suit": "x-suits",
  xsuit: "x-suits",
  xsuite: "x-suits",
  "x-suite": "x-suits",
  "x-suit-store": "x-suits",
  xsuits: "x-suits",
  "x-suits": "x-suits",
};

/** Human labels used when a category row uses a technical name. */
export const CATEGORY_LABEL_OVERRIDES: Record<string, string> = {
  accounts: "Accounts",
  uc: "UC Purchase",
  "super-cars": "Super-Car",
  "x-suits": "X-Suit",
};

export function normalizeSlug(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Resolve a visitor-facing slug to the canonical category slug. */
export function canonicalCategorySlug(slug: string): string {
  const normalized = normalizeSlug(slug);
  return CATEGORY_SLUG_ALIASES[normalized] ?? normalized;
}

/**
 * The slug the public API exposes. Products and categories are both mapped
 * through this, so a database row stored as `Supercar`, `super_car` or
 * `super-car` matches the canonical `super-cars` listings.
 */
export function publicCategorySlug(slug: string): string {
  return canonicalCategorySlug(slug);
}

/** The one true public URL for a category slug. */
export function categoryHref(slug: string): string {
  const canonical = canonicalCategorySlug(slug);
  return CATEGORY_ROUTE_OVERRIDES[canonical] ?? `/category/${encodeURIComponent(canonical)}`;
}

/** Public URL for a CMS page. */
export function pageHref(slug: string): string {
  return `/pages/${encodeURIComponent(normalizeSlug(slug))}`;
}

/** Display label for a category (prefers the admin-entered name). */
export function categoryLabel(category: Pick<Category, "name" | "slug">): string {
  const override = CATEGORY_LABEL_OVERRIDES[canonicalCategorySlug(category.slug)];
  return (category.name || "").trim() || override || canonicalCategorySlug(category.slug);
}

/**
 * A product/category is publicly visible only when neither the legacy
 * `is_active` flag nor the publish alias says otherwise.
 *
 * `undefined` counts as visible: the database repair job backfills NULL flags,
 * but an older row must never disappear just because a column was added in a
 * later migration without a value.
 */
export function isVisible(item: { isActive?: boolean | null; isPublished?: boolean | null } | null | undefined): boolean {
  if (!item) return false;
  if (item.isActive === false) return false;
  if (item.isPublished === false) return false;
  return true;
}

/** Narrow a category/product to the publicly renderable shape. */
export function isProductVisible(product: Product): boolean {
  return isVisible(product);
}

export function isCategoryVisible(category: Category): boolean {
  return isVisible(category);
}

export function isPageVisible(page: StorePage): boolean {
  return isVisible(page);
}

/** Stable ordering used by every storefront list. */
export function byCatalogOrder<T extends { sortOrder?: number | null; name?: string; title?: string }>(a: T, b: T): number {
  const orderA = typeof a.sortOrder === "number" ? a.sortOrder : 100;
  const orderB = typeof b.sortOrder === "number" ? b.sortOrder : 100;
  if (orderA !== orderB) return orderA - orderB;
  const labelA = (a.name ?? a.title ?? "").toLowerCase();
  const labelB = (b.name ?? b.title ?? "").toLowerCase();
  return labelA.localeCompare(labelB);
}

/**
 * Canonical default navigation. It is shown while the catalog request is in
 * flight — and kept if the request fails — so a temporary API/database issue
 * can never make the category system "vanish" from the public site again.
 */
export const DEFAULT_CATEGORY_NAV: { slug: string; label: string; href: string }[] = [
  { slug: "accounts", label: "Accounts", href: "/accounts" },
  { slug: "uc", label: "UC Purchase", href: "/uc-purchase" },
  { slug: "super-cars", label: "Super-Car", href: categoryHref("super-cars") },
  { slug: "x-suits", label: "X-Suit", href: categoryHref("x-suits") },
];
