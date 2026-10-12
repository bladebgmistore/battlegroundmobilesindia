/**
 * Indian mobile-number helpers — shared by the browser (phone login form) and
 * the server (session bootstrap) so validation can never drift apart.
 *
 * Pure module: no React, no Node APIs, safe to import from an Edge runtime.
 */

/** A valid Indian mobile number: 10 digits starting with 6, 7, 8 or 9. */
export const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/;

/** Country code used by every phone sign-in in this store. */
export const INDIA_DIAL_CODE = "+91";

/**
 * Reduce any user input (`98765 43210`, `+91 98765-43210`, `09876543210`,
 * `0091 98765 43210`, `919876543210`) to the canonical 10-digit Indian mobile
 * number, or `null` when it is not a valid Indian mobile number.
 */
export function normalizeIndianMobile(input: string | null | undefined): string | null {
  if (!input) return null;
  // Keep digits only, then drop the international / national trunk prefixes.
  let digits = String(input).replace(/\D/g, "");
  if (digits.startsWith("0091")) digits = digits.slice(4);
  else if (digits.startsWith("91") && digits.length > 10) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length > 10) digits = digits.replace(/^0+/, "");
  // Anything longer than 10 digits is not an Indian mobile number.
  if (digits.length > 10) digits = digits.slice(-10);
  return INDIAN_MOBILE_PATTERN.test(digits) ? digits : null;
}

/** `9876543210` → `+919876543210` (the E.164 form Firebase Phone Auth needs). */
export function toE164India(mobile: string): string {
  return `${INDIA_DIAL_CODE}${normalizeIndianMobile(mobile) ?? String(mobile).replace(/\D/g, "").slice(-10)}`;
}

/**
 * Strictly format any phone input to `+91XXXXXXXXXX` for Firebase Phone Auth.
 * Returns null if the number is not a valid 10-digit Indian mobile number.
 */
export function formatStrictIndianPhone(input: string | null | undefined): string | null {
  const norm = normalizeIndianMobile(input);
  if (!norm) return null;
  return `${INDIA_DIAL_CODE}${norm}`;
}

/** `9876543210` → `98765 43210` — how Indian numbers are usually written. */
export function formatIndianMobile(mobile: string | null | undefined): string {
  const local = normalizeIndianMobile(mobile);
  if (!local) return "";
  return `${local.slice(0, 5)} ${local.slice(5)}`;
}

/** `+919876543210` → `98765 43210` (display helper for stored numbers). */
export function formatE164India(e164: string | null | undefined): string {
  return formatIndianMobile(e164 ?? "");
}

/**
 * Privacy-friendly mask for confirmation copy — `+91 ••••• 43210`.
 * Used on the OTP screen so the full number is never re-printed.
 */
export function maskIndianMobile(mobile: string | null | undefined): string {
  const local = normalizeIndianMobile(mobile);
  if (!local) return "";
  return `${INDIA_DIAL_CODE} ••••• ${local.slice(-5)}`;
}

/** True when the value is already a full E.164 Indian mobile (`+91…`). */
export function isIndianE164(value: string | null | undefined): boolean {
  return Boolean(value && /^\+91[6-9]\d{9}$/.test(value.trim()));
}
