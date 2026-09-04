import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { buildWhatsappUrl, DEFAULT_WHATSAPP_NUMBER } from "@/lib/store-data";
import { inArray } from "drizzle-orm";

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

export type PublicSettings = {
  values: Record<string, string>;
  whatsappNumber: string;
  whatsappUrl: string;
};

/**
 * Server-side reader for admin-managed public settings.
 *
 * WARNING: This function performs a DB query, and the DB client is configured
 * with a no-store fetch. Calling it while Next.js statically prerenders a page
 * (e.g. from the root layout or any page without `dynamic = "force-dynamic"`)
 * throws "Dynamic server usage ... DYNAMIC_SERVER_USAGE" at build time. Only
 * use it inside route handlers or pages/routes that are explicitly dynamic.
 * Public storefront settings are served live to the browser via `/api/store`
 * (see `src/lib/use-store-settings.ts`), so prefer that path for static pages.
 */
export async function getPublicSettings(): Promise<PublicSettings> {
  const values: Record<string, string> = {};

  try {
    const rows = await db
      .select()
      .from(siteSettings)
      .where(inArray(siteSettings.settingKey, PUBLIC_SETTING_KEYS));
    for (const row of rows) values[row.settingKey] = String(row.value ?? "");
  } catch (error) {
    console.error("Public settings read failed, using defaults:", error);
  }

  const whatsappNumber = values.whatsapp_number || DEFAULT_WHATSAPP_NUMBER;
  return {
    values,
    whatsappNumber,
    whatsappUrl: buildWhatsappUrl(whatsappNumber),
  };
}
