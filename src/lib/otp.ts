/**
 * Random 6-digit OTP generation for gaming-account orders.
 *
 * Codes are generated SERVER-SIDE ONLY — never by the browser and never typed
 * in by the admin. `globalThis.crypto.getRandomValues` is used with rejection
 * sampling so every code in 100000–999999 is equally likely; the Math.random
 * fallback only exists for exotic runtimes without Web Crypto.
 */

const MIN = 100000;
const RANGE = 900000; // 100000 → 999999

/** Returns a uniformly distributed 6-digit numeric string, e.g. "482910". */
export function generateOtpCode(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const buffer = new Uint32Array(1);
    // Reject the (tiny) top slice so the modulo is unbiased.
    const limit = Math.floor(0xffffffff / RANGE) * RANGE;
    for (let attempt = 0; attempt < 16; attempt += 1) {
      cryptoApi.getRandomValues(buffer);
      if (buffer[0] < limit) return String(MIN + (buffer[0] % RANGE));
    }
  }
  return String(MIN + Math.floor(Math.random() * RANGE));
}

/** True for exactly six ASCII digits. */
export function isValidOtpCode(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value);
}

/** Normalise an admin/customer supplied code, or return null when invalid. */
export function normalizeOtpCode(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 6 ? digits : null;
}
