"use client";

import { useStoreCatalog } from "@/lib/use-store-catalog";
import { buildWhatsappUrl, DEFAULT_CHECKOUT_MODE, DEFAULT_UPI_ID, DEFAULT_WHATSAPP_NUMBER, type CheckoutMode } from "@/lib/store-data";

/**
 * Live admin-managed public settings.
 *
 * Settings arrive inside the shared `/api/store` payload (see
 * `use-store-catalog.ts`) instead of a second fetch, so every consumer sees
 * exactly the same catalog/settings snapshot.
 *
 * WhatsApp contact is admin-controlled: `whatsappEnabled` is true only when
 * the admin turned the channel on in Admin Dashboard → Site Controls. While
 * disabled, `whatsappNumber` / `whatsapp` / `whatsappWithText` are empty so no
 * WhatsApp button, icon or link can be rendered anywhere on the site.
 */
export function useStoreSettings() {
  const { settings } = useStoreCatalog();

  const whatsappEnabled = settings.whatsapp_enabled === "true";
  const whatsappNumber = whatsappEnabled ? settings.whatsapp_number || DEFAULT_WHATSAPP_NUMBER : "";
  const whatsapp = whatsappEnabled ? buildWhatsappUrl(whatsappNumber) : "";
  const whatsappWithText = (text: string) => (whatsappEnabled ? buildWhatsappUrl(whatsappNumber, text) : "");

  const upiId = settings.upi_id || DEFAULT_UPI_ID;
  const checkoutMode = (settings.checkout_mode as CheckoutMode) || DEFAULT_CHECKOUT_MODE;

  return {
    settings,
    whatsapp,
    whatsappWithText,
    whatsappNumber,
    /** Admin toggle: WhatsApp contact channel (Site Controls). */
    whatsappEnabled,
    upiId,
    checkoutMode,
    maintenance: String(settings.maintenance_mode) === "true",
  };
}
