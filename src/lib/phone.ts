/**
 * WhatsApp / phone number helpers — shared by the client (country-code picker
 * in the signup prompt + Profile & Security) and the server (profile update
 * validation).
 *
 * Storage format is E.164 with the leading plus, e.g. `+919876543210`, so the
 * saved number is always dialable from any country. Nothing is ever masked or
 * filled with dummy digits — a missing number is simply `null`.
 */

export type CountryDialCode = {
  /** ISO-3166 alpha-2 code, e.g. "IN". */
  iso: string;
  name: string;
  /** International dialling prefix, e.g. "+91". */
  dial: string;
  flag: string;
};

/**
 * The dialling codes offered by the picker. India first (primary market),
 * followed by the other regions BGMI buyers commonly sign up from.
 */
export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  { iso: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { iso: "AE", name: "United Arab Emirates", dial: "+971", flag: "🇦🇪" },
  { iso: "SA", name: "Saudi Arabia", dial: "+966", flag: "🇸🇦" },
  { iso: "QA", name: "Qatar", dial: "+974", flag: "🇶🇦" },
  { iso: "KW", name: "Kuwait", dial: "+965", flag: "🇰🇼" },
  { iso: "OM", name: "Oman", dial: "+968", flag: "🇴🇲" },
  { iso: "BH", name: "Bahrain", dial: "+973", flag: "🇧🇭" },
  { iso: "NP", name: "Nepal", dial: "+977", flag: "🇳🇵" },
  { iso: "BD", name: "Bangladesh", dial: "+880", flag: "🇧🇩" },
  { iso: "LK", name: "Sri Lanka", dial: "+94", flag: "🇱🇰" },
  { iso: "PK", name: "Pakistan", dial: "+92", flag: "🇵🇰" },
  { iso: "SG", name: "Singapore", dial: "+65", flag: "🇸🇬" },
  { iso: "MY", name: "Malaysia", dial: "+60", flag: "🇲🇾" },
  { iso: "ID", name: "Indonesia", dial: "+62", flag: "🇮🇩" },
  { iso: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭" },
  { iso: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
  { iso: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { iso: "US", name: "United States / Canada", dial: "+1", flag: "🇺🇸" },
  { iso: "ZA", name: "South Africa", dial: "+27", flag: "🇿🇦" },
  { iso: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
  { iso: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { iso: "IT", name: "Italy", dial: "+39", flag: "🇮🇹" },
  { iso: "ES", name: "Spain", dial: "+34", flag: "🇪🇸" },
  { iso: "RU", name: "Russia", dial: "+7", flag: "🇷🇺" },
];

export const DEFAULT_DIAL_CODE = "+91";

/** Longest dial prefixes first so "+971" wins over "+97". */
const DIALS_BY_LENGTH = [...COUNTRY_DIAL_CODES]
  .map((country) => country.dial)
  .filter((dial, index, all) => all.indexOf(dial) === index)
  .sort((a, b) => b.length - a.length);

/** E.164 allows 8–15 digits including the country code. */
const MIN_DIGITS = 8;
const MAX_DIGITS = 15;

/**
 * Normalise any user input to E.164 (`+919876543210`).
 *
 * Accepts `9876543210`, `+91 98765 43210`, `91-98765-43210`, `(987) 654-3210`.
 * A bare 10-digit number is assumed to use `defaultDial`. Returns `null` when
 * the value cannot be a real phone number.
 */
export function normalizeWhatsapp(
  value: string | null | undefined,
  defaultDial: string = DEFAULT_DIAL_CODE,
): string | null {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;

  const explicitDial = text.startsWith("+");
  let digits = text.replace(/\D/g, "");
  if (!digits) return null;

  // 00-prefixed international form (e.g. 0091 98765 43210).
  if (!explicitDial && digits.startsWith("00")) digits = digits.slice(2);

  const dialDigits = defaultDial.replace(/\D/g, "");
  if (!explicitDial) {
    if (digits.length === 10) {
      digits = `${dialDigits}${digits}`;
    } else if (digits.startsWith("0") && digits.length === 11) {
      // Domestic trunk prefix, e.g. 09876543210.
      digits = `${dialDigits}${digits.slice(1)}`;
    }
  }

  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;
  return `+${digits}`;
}

/**
 * Split a stored E.164 number into the picker's dial code + local digits.
 *
 * This is deliberately a *raw* split — it never validates, because it also runs
 * on every keystroke while the field is half-typed. An earlier version routed
 * through `normalizeWhatsapp`, which rejects anything shorter than 8 digits, so
 * the first 7 digits the buyer typed were discarded and the field rendered
 * empty (typing looked broken on both desktop and mobile). Validation happens
 * separately in `isCompleteLocalNumber` / `normalizeWhatsapp`.
 */
export function splitWhatsapp(
  value: string | null | undefined,
  fallbackDial: string = DEFAULT_DIAL_CODE,
): { dial: string; local: string } {
  const text = String(value ?? "").trim();
  const digits = text.replace(/\D/g, "");
  if (!digits) return { dial: fallbackDial, local: "" };

  // Untagged digits (legacy / pasted local number) belong to the chosen country.
  if (!text.startsWith("+")) {
    return { dial: fallbackDial, local: digits.slice(0, MAX_DIGITS) };
  }

  const dial = DIALS_BY_LENGTH.find((candidate) => digits.startsWith(candidate.slice(1)));
  if (!dial) {
    // Still typing the country code (e.g. "+9") — keep the digits visible.
    return { dial: fallbackDial, local: digits.slice(0, MAX_DIGITS) };
  }
  return { dial, local: digits.slice(dial.replace(/\D/g, "").length).slice(0, MAX_DIGITS) };
}

/** Human-friendly display: `+91 98765 43210`. */
export function formatWhatsapp(value: string | null | undefined, fallbackDial: string = DEFAULT_DIAL_CODE): string {
  const normalized = normalizeWhatsapp(value, fallbackDial);
  if (!normalized) return "";
  const { dial, local } = splitWhatsapp(normalized);
  if (local.length === 10) return `${dial} ${local.slice(0, 5)} ${local.slice(5)}`;
  if (local.length > 10) return `${dial} ${local.slice(0, local.length - 5)} ${local.slice(-5)}`;
  return local ? `${dial} ${local}` : dial;
}

/** Country metadata for a stored number (flag + name for the UI). */
export function countryForWhatsapp(value: string | null | undefined): CountryDialCode | null {
  const normalized = normalizeWhatsapp(value);
  if (!normalized) return null;
  const digits = normalized.slice(1);
  const dial = DIALS_BY_LENGTH.find((candidate) => digits.startsWith(candidate.slice(1)));
  if (!dial) return null;
  return COUNTRY_DIAL_CODES.find((country) => country.dial === dial) ?? null;
}

/** True when the local part looks like a complete number for its country. */
export function isCompleteLocalNumber(dial: string, local: string): boolean {
  const digits = local.replace(/\D/g, "");
  if (!digits) return false;
  if (dial === "+91") return digits.length === 10;
  return digits.length >= 6 && digits.length <= 14;
}
