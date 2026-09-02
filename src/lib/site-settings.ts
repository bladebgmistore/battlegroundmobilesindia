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
];

export type PublicSettings = {
  values: Record<string, string>;
  whatsappNumber: string;
  whatsappUrl: string;
};

/**
 * Server-side reader for admin-managed public settings so server components
 * return the correct WhatsApp number in the first HTML paint.
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
