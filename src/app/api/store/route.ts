import { db } from "@/db";
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
import { asc, eq, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PUBLIC_SETTING_KEYS = [
  "whatsapp_number",
  "instagram_url",
  "youtube_url",
  "maintenance_mode",
  "homepage_headline",
  "logo_url",
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
    const [categoryRows, productRows, ucRows, settingRows] = await Promise.all([
      db
        .select()
        .from(categories)
        .where(eq(categories.isActive, true))
        .orderBy(asc(categories.sortOrder), asc(categories.name)),
      db
        .select()
        .from(products)
        .where(eq(products.isActive, true))
        .orderBy(asc(products.categorySlug), asc(products.sortOrder), asc(products.createdAt)),
      db
        .select()
        .from(ucPackages)
        .where(eq(ucPackages.isActive, true))
        .orderBy(asc(ucPackages.price)),
      db
        .select()
        .from(siteSettings)
        .where(inArray(siteSettings.settingKey, PUBLIC_SETTING_KEYS)),
    ]);

    // Hide any product whose parent category has been disabled in the admin
    // panel, so disabling a category removes all of its packages everywhere.
    const activeCategorySlugs = new Set(categoryRows.map((c) => c.slug));
    const visibleProducts = productRows.filter((p) => activeCategorySlugs.has(p.categorySlug));

    const settings: Record<string, string> = {};
    for (const row of settingRows) settings[row.settingKey] = String(row.value ?? "");
    if (!settings.whatsapp_number) settings.whatsapp_number = DEFAULT_WHATSAPP_NUMBER;
    if (!settings.upi_id) settings.upi_id = DEFAULT_UPI_ID;
    if (!settings.checkout_mode) settings.checkout_mode = DEFAULT_CHECKOUT_MODE;

    // When the database query succeeds, return its exact state. This is
    // important so admin deletes/disables are reflected publicly.
    return Response.json(
      {
        categories: categoryRows.map((category) => ({ ...category, image: convertGoogleDriveUrl(category.image ?? "") })),
        products: visibleProducts.map((product) => ({ ...product, image: convertGoogleDriveUrl(product.image) })),
        ucPackages: ucRows,
        settings,
        databaseOnline: true,
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    console.error("Store database read failed, using bundled fallback:", error);
    return Response.json(
      {
        categories: defaultCategories,
        products: defaultProducts,
        ucPackages: defaultUcPackages,
        settings: { whatsapp_number: DEFAULT_WHATSAPP_NUMBER, upi_id: DEFAULT_UPI_ID, checkout_mode: DEFAULT_CHECKOUT_MODE },
        databaseOnline: false,
      },
      { headers: noStoreHeaders },
    );
  }
}
