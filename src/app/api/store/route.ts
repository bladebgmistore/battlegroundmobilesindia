import { db2 } from "@/db";
import { categories, products, siteSettings, ucPackages } from "@/db/schema";
import {
  DEFAULT_CHECKOUT_MODE,
  DEFAULT_UPI_ID,
  DEFAULT_WHATSAPP_NUMBER,
  defaultCategories,
  defaultProducts,
  defaultUcPackages,
} from "@/lib/store-data";
import { convertGoogleDriveUrl } from "@/lib/image-utils";
import { ensureStoreTables } from "@/lib/store-tables";
import { asc, eq, inArray } from "drizzle-orm";

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
};

export async function GET() {
  try {
    await ensureStoreTables();
    const [categoryRows, productRows, ucRows, settingRows] = await Promise.all([
      db2.select()
        .from(categories)
        .where(eq(categories.isActive, true))
        .orderBy(asc(categories.sortOrder), asc(categories.name)),
      db2.select()
        .from(products)
        .where(eq(products.isActive, true))
        .orderBy(asc(products.categorySlug), asc(products.sortOrder), asc(products.createdAt)),
      db2.select()
        .from(ucPackages)
        .where(eq(ucPackages.isActive, true))
        .orderBy(asc(ucPackages.price)),
      db2.select()
        .from(siteSettings)
        .where(inArray(siteSettings.settingKey, PUBLIC_SETTING_KEYS)),
    ]);

    // Only surface products that belong to an active category, so a disabled
    // category's Checkout buttons disappear from every page (home, category pages).
    const activeCategorySlugs = new Set(categoryRows.map((c) => c.slug));
    const visibleProductRows = productRows.filter((p) => activeCategorySlugs.has(p.categorySlug));

    const settings: Record<string, string> = {};
    for (const row of settingRows) settings[row.settingKey] = String(row.value ?? "");
    if (!settings.upi_id) settings.upi_id = DEFAULT_UPI_ID;
    if (!settings.checkout_mode) settings.checkout_mode = DEFAULT_CHECKOUT_MODE;

    // WhatsApp contact is admin-controlled: the number is only exposed
    // publicly while the admin has enabled the WhatsApp channel. Otherwise no
    // client can build a wa.me link from the public payload at all.
    const whatsappEnabled = settings.whatsapp_enabled === "true";
    if (whatsappEnabled) {
      if (!settings.whatsapp_number) settings.whatsapp_number = DEFAULT_WHATSAPP_NUMBER;
    } else {
      delete settings.whatsapp_number;
    }
    settings.whatsapp_enabled = whatsappEnabled ? "true" : "false";

    // When the database query succeeds, return its exact state. This is
    // important so admin deletes/disables are reflected publicly.
    return Response.json(
      {
        categories: categoryRows.map((category) => ({ ...category, image: convertGoogleDriveUrl(category.image ?? "") })),
        products: visibleProductRows.map((product) => ({ ...product, image: convertGoogleDriveUrl(product.image) })),
        ucPackages: ucRows,
        settings,
        databaseOnline: true,
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    console.error("Store database read failed:", error);

    /**
     * Preview / offline helper — DISABLED by default.
     *
     * When `STORE_DEMO_CATALOG=1` is set in a NON-production build, the built-in
     * sample catalog (src/lib/store-data.ts) is served instead of an empty one,
     * so the storefront, the cart drawer and the add-to-cart buttons can be
     * exercised without a live database.
     *
     * It can never leak into a real storefront: it needs the explicit env
     * opt-in AND a non-production runtime, and it only runs when the database
     * read has already failed. Delete this block if you don't want it at all.
     */
    if (process.env.STORE_DEMO_CATALOG === "1" && process.env.NODE_ENV !== "production") {
      console.warn("[store] STORE_DEMO_CATALOG=1 — serving the built-in demo catalog (non-production only).");
      return Response.json(
        {
          categories: defaultCategories,
          products: defaultProducts,
          ucPackages: defaultUcPackages,
          settings: {
            whatsapp_enabled: "false",
            upi_id: DEFAULT_UPI_ID,
            checkout_mode: DEFAULT_CHECKOUT_MODE,
          },
          databaseOnline: false,
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
        // DB offline → WhatsApp contact stays hidden (admin toggle required).
        settings: { whatsapp_enabled: "false", upi_id: DEFAULT_UPI_ID, checkout_mode: DEFAULT_CHECKOUT_MODE },
        databaseOnline: false,
      },
      { headers: noStoreHeaders, status: 503 },
    );
  }
}
