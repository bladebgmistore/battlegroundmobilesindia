import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { buildWhatsappUrl, DEFAULT_WHATSAPP_NUMBER } from "@/lib/store-data";
import { inArray } from "drizzle-orm";

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

export type PublicSettings = {
  values: Record<string, string>;
  /** True only when the admin enabled the WhatsApp channel in Site Controls. */
  whatsappEnabled: boolean;
  /** Empty string while the WhatsApp channel is disabled (hidden site-wide). */
  whatsappNumber: string;
  /** Empty string while the WhatsApp channel is disabled. */
  whatsappUrl: string;
};

/**
 * Server-side reader for admin-managed public settings so server components
 * return the correct WhatsApp number in the first HTML paint.
 *
 * WhatsApp contact is admin-controlled: unless the admin enabled the channel
 * (whatsapp_enabled = "true"), the number and wa.me URL are withheld entirely.
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

  const whatsappEnabled = values.whatsapp_enabled === "true";
  const whatsappNumber = whatsappEnabled ? values.whatsapp_number || DEFAULT_WHATSAPP_NUMBER : "";
  return {
    values,
    whatsappEnabled,
    whatsappNumber,
    whatsappUrl: whatsappEnabled ? buildWhatsappUrl(whatsappNumber) : "",
  };
}
