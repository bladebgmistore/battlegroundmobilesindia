import { db2 } from "@/db";
import { categories, pages, products, siteSettings, ucPackages } from "@/db/schema";
import {
  canonicalCategorySlug,
  isVisible,
} from "@/lib/catalog";
import {
  DEFAULT_CHECKOUT_MODE,
  DEFAULT_UPI_ID,
  DEFAULT_WHATSAPP_NUMBER,
  FALLBACK_IMAGE,
  defaultCategories,
  defaultProducts,
  defaultUcPackages,
} from "@/lib/store-data";
import { convertGoogleDriveUrl } from "@/lib/image-utils";
import { ensureStoreTables } from "@/lib/store-tables";
import { asc, inArray, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PUBLIC_SETTING_KEYS = [
  "whatsapp_number",
  "whatsapp_enabled",
  "instagram_url",
  "youtube_url",
  "maintenance_mode",
  "homepage_headline",
  "logo_url",
  "favicon_url",
  "upi_id",
  "checkout_mode",
  "featured_drop_label",
  "featured_drop_title",
  "featured_drop_image",
];

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

/**
 * Public catalogue read.
 *
 * Any row whose `is_active` was left NULL by an older database import counts
 * as published (`coalesce(is_active, true)`). Admin-created rows are returned
 * with a normalised boolean plus an `isPublished` alias so both naming
 * conventions used by the dashboard and older clients keep working.
 *
 * Each dataset is fetched independently. A single failing table used to throw
 * the whole handler into its catch block, which returned an empty catalogue —
 * the storefront then looked like "all categories vanished" even though the
 * admin panel could still list them. Now a partial failure degrades to the
 * data that IS readable and reports the failing sections in `warnings`.
 */
export async function GET() {
  await ensureStoreTables();

  /**
   * Run each query inside an async wrapper so that even a *synchronous*
   * failure (e.g. the lazily-created DB client throwing because an env var is
   * missing) becomes a rejected promise handled by `allSettled` instead of
   * escaping the handler as an opaque 500.
   */
  const readSection = <T,>(query: () => Promise<T[]>): Promise<T[]> => (async () => query())();

  const results = await Promise.allSettled([
    readSection(() =>
      db2
        .select()
        .from(categories)
        .where(sql`coalesce(${categories.isActive}, true) = true`)
        .orderBy(asc(categories.sortOrder), asc(categories.name)),
    ),
    readSection(() =>
      db2
        .select()
        .from(products)
        .where(sql`coalesce(${products.isActive}, true) = true`)
        .orderBy(asc(products.categorySlug), asc(products.sortOrder), asc(products.createdAt)),
    ),
    readSection(() =>
      db2
        .select()
        .from(ucPackages)
        .where(sql`coalesce(${ucPackages.isActive}, true) = true`)
        .orderBy(asc(ucPackages.price)),
    ),
    readSection(() =>
      db2
        .select()
        .from(pages)
        .where(sql`coalesce(${pages.isActive}, true) = true`)
        .orderBy(asc(pages.sortOrder), asc(pages.title)),
    ),
    readSection(() =>
      db2
        .select()
        .from(siteSettings)
        .where(inArray(siteSettings.settingKey, PUBLIC_SETTING_KEYS)),
    ),
  ] as const);

  const readRows = <T>(result: PromiseSettledResult<T[]>): T[] => {
    if (result.status === "fulfilled") return result.value;
    console.error("Store catalog section read failed:", result.reason);
    return [];
  };

  const categoryRows = readRows(results[0]);
  const productRows = readRows(results[1]);
  const ucRows = readRows(results[2]);
  const pageRows = readRows(results[3]);
  const settingRows = readRows(results[4]);

  const warnings: string[] = [];
  if (results[0].status === "rejected") warnings.push("categories");
  if (results[1].status === "rejected") warnings.push("products");
  if (results[2].status === "rejected") warnings.push("ucPackages");
  if (results[3].status === "rejected") warnings.push("pages");
  if (results[4].status === "rejected") warnings.push("settings");

  const categoriesOk = results[0].status === "fulfilled";
  const productsOk = results[1].status === "fulfilled";
  const databaseOnline = warnings.length === 0;

  // Canonicalise every slug once. Databases imported by hand commonly contain
  // `Account`, `Supercar`, `X-Suite` or `UC-Purchase`; the storefront compares
  // canonical slugs, so doing it here fixes "category shown in admin but its
  // products never appear on the public category page".
  const categorySlugOf = (row: { slug?: string | null }): string =>
    canonicalCategorySlug(row.slug ?? "");
  const productCategorySlugOf = (row: { categorySlug?: string | null }): string =>
    canonicalCategorySlug(row.categorySlug ?? "");

  const activeCategorySlugs = new Set(categoryRows.map(categorySlugOf));

  /**
   * Hide products that belong to an explicitly disabled category — but only
   * when we actually have categories to compare against. If the category read
   * failed (or the table is genuinely empty), keeping published products
   * visible is far safer than rendering an empty store.
   */

  const visibleProductRows =
    categoriesOk && activeCategorySlugs.size > 0
      ? productRows.filter((product) => activeCategorySlugs.has(productCategorySlugOf(product)))
      : productRows;

  // UC packages belong to the `uc` category. When that category is disabled,
  // stop exposing the packages too so every page/checkout agrees.
  const ucCategoryActive =
    !categoriesOk || activeCategorySlugs.size === 0 || activeCategorySlugs.has("uc");
  const visibleUcRows = ucCategoryActive ? ucRows : [];

  // Two legacy rows can canonicalise to the same slug (`Account` + `accounts`).
  // Keep the first (sort_order wins) so the nav never renders duplicate keys.
  const seenCategorySlugs = new Set<string>();
  const visibleCategoryRows = categoryRows.filter((category) => {
    const slug = categorySlugOf(category);
    if (!slug || seenCategorySlugs.has(slug)) return false;
    seenCategorySlugs.add(slug);
    return true;
  });

  const settings: Record<string, string> = {};
  for (const row of settingRows) settings[row.settingKey] = String(row.value ?? "");
  if (!settings.upi_id) settings.upi_id = DEFAULT_UPI_ID;
  if (!settings.checkout_mode) settings.checkout_mode = DEFAULT_CHECKOUT_MODE;

  // WhatsApp contact is admin-controlled: the number is only exposed publicly
  // while the admin has enabled the WhatsApp channel.
  const whatsappEnabled = settings.whatsapp_enabled === "true";
  if (whatsappEnabled) {
    if (!settings.whatsapp_number) settings.whatsapp_number = DEFAULT_WHATSAPP_NUMBER;
  } else {
    delete settings.whatsapp_number;
  }
  settings.whatsapp_enabled = whatsappEnabled ? "true" : "false";

  const payload = {
    categories: visibleCategoryRows
      .filter((category) => isVisible({ isActive: category.isActive ?? true }))
      .map((category) => ({
        ...category,
        slug: categorySlugOf(category),
        name: category.name?.trim() || categorySlugOf(category),
        description: category.description ?? "",
        image: convertGoogleDriveUrl(category.image ?? "") || FALLBACK_IMAGE,
        isActive: category.isActive !== false,
        isPublished: category.isActive !== false,
      })),
    products: visibleProductRows
      .filter((product) => productsOk && isVisible({ isActive: product.isActive ?? true }))
      .map((product) => ({
        ...product,
        // Normalised so the category page's exact-match filter works even when
        // the row was imported as `Supercar` / `Xsuite`.
        categorySlug: productCategorySlugOf(product),
        features: Array.isArray(product.features) ? product.features : [],
        image: convertGoogleDriveUrl(product.image ?? "") || FALLBACK_IMAGE,
        isActive: product.isActive !== false,
        isPublished: product.isActive !== false,
      })),
    ucPackages: visibleUcRows
      .filter((pack) => isVisible({ isActive: pack.isActive ?? true }))
      .map((pack) => ({
        ...pack,
        isActive: pack.isActive !== false,
        isPublished: pack.isActive !== false,
      })),
    pages: pageRows
      .filter((page) => isVisible({ isActive: page.isActive ?? true }))
      .map((page) => ({
        ...page,
        content: page.content ?? "",
        image: page.image ? convertGoogleDriveUrl(page.image) : null,
        isActive: page.isActive !== false,
        isPublished: page.isActive !== false,
      })),
    settings,
    databaseOnline,
    degraded: warnings.length > 0,
    warnings,
  };

  /**
   * Nothing was readable. Keep the explicit demo fallback for local preview
   * (opt-in + non-production only), otherwise surface a real 503 so the
   * storefront can show its "catalog unavailable" state instead of pretending
   * the admin deleted every product.
   */
  if (warnings.length === 5) {
    if (process.env.STORE_DEMO_CATALOG === "1" && process.env.NODE_ENV !== "production") {
      console.warn("[store] STORE_DEMO_CATALOG=1 — serving the built-in demo catalog (non-production only).");
      return Response.json(
        {
          categories: defaultCategories.map((category) => ({ ...category, isPublished: true })),
          products: defaultProducts.map((product) => ({ ...product, isPublished: true })),
          ucPackages: defaultUcPackages.map((pack) => ({ ...pack, isPublished: true })),
          pages: [],
          settings: {
            whatsapp_enabled: "false",
            upi_id: DEFAULT_UPI_ID,
            checkout_mode: DEFAULT_CHECKOUT_MODE,
          },
          databaseOnline: false,
          degraded: true,
          warnings,
          demoCatalog: true,
        },
        { headers: noStoreHeaders, status: 200 },
      );
    }

    return Response.json(
      {
        categories: [],
        products: [],
        ucPackages: [],
        pages: [],
        settings: { whatsapp_enabled: "false", upi_id: DEFAULT_UPI_ID, checkout_mode: DEFAULT_CHECKOUT_MODE },
        databaseOnline: false,
        degraded: true,
        warnings,
      },
      { headers: noStoreHeaders, status: 503 },
    );
  }

  return Response.json(payload, { headers: noStoreHeaders });
}
