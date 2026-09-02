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
      .then((d) => (cache = (d?.settings as PublicSettings) ?? { whatsapp_number: DEFAULT_WHATSAPP_NUMBER }))
      .catch(() => (cache = { whatsapp_number: DEFAULT_WHATSAPP_NUMBER }));
  }
  return inflight;
}

/** Live admin-managed public settings (WhatsApp number, socials, maintenance flag). */
export function useStoreSettings() {
  const [settings, setSettings] = useState<PublicSettings>(
    cache ?? { whatsapp_number: DEFAULT_WHATSAPP_NUMBER }
  );

  useEffect(() => {
    let alive = true;
    fetchSettings().then((s) => {
      if (alive) setSettings(s);
    });
    return () => { alive = false; };
  }, []);

  const whatsappNumber = settings.whatsapp_number || DEFAULT_WHATSAPP_NUMBER;
  const whatsapp = buildWhatsappUrl(whatsappNumber);
  const whatsappWithText = (text: string) => buildWhatsappUrl(whatsappNumber, text);

  const upiId = settings.upi_id || DEFAULT_UPI_ID;
  const checkoutMode = (settings.checkout_mode as CheckoutMode) || DEFAULT_CHECKOUT_MODE;

  return {
    settings,
    whatsapp,
    whatsappWithText,
    whatsappNumber,
    upiId,
    checkoutMode,
    maintenance: String(settings.maintenance_mode) === "true",
  };
}
