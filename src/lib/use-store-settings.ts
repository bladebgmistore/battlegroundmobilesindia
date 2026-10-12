"use client";

import { useEffect, useState } from "react";
import { buildWhatsappUrl, DEFAULT_CHECKOUT_MODE, DEFAULT_UPI_ID, DEFAULT_WHATSAPP_NUMBER, type CheckoutMode } from "@/lib/store-data";

type PublicSettings = Record<string, string>;

let cache: PublicSettings | null = null;
let inflight: Promise<PublicSettings> | null = null;

function fetchSettings() {
  if (!inflight) {
    inflight = fetch("/api/store")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (cache = (d?.settings as PublicSettings) ?? { whatsapp_enabled: "false" }))
      .catch(() => (cache = { whatsapp_enabled: "false" }));
  }
  return inflight;
}

/**
 * Live admin-managed public settings.
 *
 * WhatsApp contact is admin-controlled: `whatsappEnabled` is true only when
 * the admin turned the channel on in Admin Dashboard → Site Controls. While
 * disabled, `whatsappNumber` / `whatsapp` / `whatsappWithText` are empty so no
 * WhatsApp button, icon or link can be rendered anywhere on the site.
 */
export function useStoreSettings() {
  const [settings, setSettings] = useState<PublicSettings>(cache ?? { whatsapp_enabled: "false" });

  useEffect(() => {
    let alive = true;
    fetchSettings().then((s) => {
      if (alive) setSettings(s);
    });
    return () => { alive = false; };
  }, []);

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
