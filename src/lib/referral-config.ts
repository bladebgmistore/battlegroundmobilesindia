/**
 * Refer & Earn / Points Store — shared constants and pure helpers.
 *
 * Edge-safe: no Node or database imports, because `src/proxy.ts` uses the
 * cookie names and the code validator to capture `?ref=` links.
 */

/** Cookie that carries the referrer's code from the referral link until signup. */
export const REFERRAL_COOKIE = "bgmi_ref";
/** A referral link stays attributable for 30 days. */
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Short-lived flag set right after a successful Google sign-in. It is NOT
 * httpOnly so the client can show the one-time "Refer & Win" pop-up.
 */
export const WELCOME_COOKIE = "bgmi_welcome";
export const WELCOME_COOKIE_MAX_AGE_SECONDS = 60 * 5;

/** Commission a referrer earns, in points, on each confirmed purchase by a referred user. */
export const REFERRAL_COMMISSION_PERCENT = 20;

/** Referral codes: 8 characters without look-alikes (no I, O, 0 or 1). */
const CODE_LENGTH = 8;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 symbols → 256 % 32 = 0, no modulo bias
export const REFERRAL_CODE_PATTERN = /^[A-Z2-9]{6,16}$/;

/** Random, human-friendly referral code (e.g. "K7FQ2MBX"). */
export function generateReferralCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code;
}

/** Clean user / cookie input; returns null when it cannot possibly be a referral code. */
export function normalizeReferralCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const code = String(value).trim().toUpperCase();
  return REFERRAL_CODE_PATTERN.test(code) ? code : null;
}

/** Points credited for a purchase: 20% of the amount actually paid, rounded down (1 point = ₹1). */
export function commissionPointsFor(purchaseAmount: number): number {
  if (!Number.isFinite(purchaseAmount) || purchaseAmount <= 0) return 0;
  return Math.floor((purchaseAmount * REFERRAL_COMMISSION_PERCENT) / 100);
}

/** Shareable link. The origin is added by the browser so the link always matches the visitor's domain. */
export function referralLinkPath(code: string): string {
  return `/?ref=${encodeURIComponent(code)}`;
}

/** Privacy-safe display form of an email, e.g. "ra***@gmail.com". */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(2, local.length - 2))}@${domain}`;
}

/** Reward items seeded the first time the points store is created (editable from Admin → Referrals & Points). */
export const DEFAULT_REWARD_ITEMS = [
  { title: "3800 UC Package", ucAmount: 3800, pointsCost: 2000, badge: "POINTS STORE", sortOrder: 10, isActive: true },
];
