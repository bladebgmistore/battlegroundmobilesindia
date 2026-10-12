import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureAuthTables } from "@/lib/auth-tables";
import { ROLE_CUSTOMER } from "@/lib/rbac";
import { normalizeIndianMobile } from "@/lib/phone-number";
import { ensureReferralCode, generateUniqueReferralCode } from "@/lib/referrals";

/**
 * Persistence for +91 phone (Firebase OTP) accounts.
 *
 * Mirrors `upsertGoogleUser` in spirit — one row per human, roles recomputed on
 * every sign-in, and a fully stateless fallback when the database is offline so
 * a phone login never hard-fails during an outage.
 *
 * Identity matching uses ONLY the Firebase uid (`users.phone_uid`). A row is
 * never adopted because it happens to hold the same WhatsApp number — that
 * would let a pre-planted profile hijack a freshly verified phone login.
 */

export type PhoneUser = {
  id: string;
  email: string | null;
  whatsapp: string | null;
  name: string;
  role: string;
  isActive: boolean;
  /** true when the row was resolved from (or written to) the database. */
  persisted: boolean;
};

/** Friendly default display name, e.g. `BGMI Player 3210`. */
export function defaultPhoneName(mobile: string | null): string {
  return mobile ? `BGMI Player ${mobile.slice(-4)}` : "BGMI Player";
}

/**
 * Create or refresh the local account for a verified Firebase phone identity.
 *
 * @param identity `{ uid, phoneNumber, name? }` — `name` is the optional
 *   display name typed on the login card; it overrides the generated
 *   `BGMI Player 1234` placeholder when supplied.
 */
export async function upsertPhoneUser(identity: {
  uid: string;
  phoneNumber: string;
  name?: string | null;
}): Promise<PhoneUser> {
  const local = normalizeIndianMobile(identity.phoneNumber);
  const typedName = identity.name?.replace(/\s+/g, " ").trim().slice(0, 120) ?? "";
  const name = typedName || defaultPhoneName(local);

  // DB-less fallback: the signed cookie still carries a usable identity
  // (`id` = Firebase uid), exactly like the Google path does when Neon is down.
  const fallback: PhoneUser = {
    id: identity.uid,
    email: null,
    whatsapp: local,
    name,
    role: ROLE_CUSTOMER,
    isActive: true,
    persisted: false,
  };

  if (!local) return fallback;

  const ready = await ensureAuthTables();
  if (!ready) return fallback;

  try {
    // ── Existing account for this Firebase uid ────────────────────────
    const [existing] = await db.select().from(users).where(eq(users.phoneUid, identity.uid)).limit(1);

    if (existing) {
      if (!existing.isActive) return { ...fallback, id: existing.id, isActive: false, persisted: true };

      // A name typed on the login card always wins; otherwise the stored one
      // (or the generated placeholder) is kept.
      const nextName = typedName || existing.name || name;

      await db
        .update(users)
        .set({
          whatsapp: existing.whatsapp ?? local,
          name: nextName,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id));

      // Accounts created before Refer & Earn get their code on next sign-in.
      if (!existing.referralCode) await ensureReferralCode(existing.id).catch(() => null);

      return {
        id: existing.id,
        email: existing.email,
        whatsapp: existing.whatsapp ?? local,
        name: nextName,
        role: existing.role || ROLE_CUSTOMER,
        isActive: existing.isActive,
        persisted: true,
      };
    }

    // ── Brand-new phone account ───────────────────────────────────────
    const referralCode = await generateUniqueReferralCode().catch(() => null);
    const base = {
      name,
      phoneUid: identity.uid,
      role: ROLE_CUSTOMER,
      isActive: true,
      lastLoginAt: new Date(),
      referralCode,
    };

    let created: typeof users.$inferSelect | undefined;
    try {
      [created] = await db.insert(users).values({ ...base, whatsapp: local }).returning();
    } catch {
      // That WhatsApp number is already linked to another profile (unique
      // index) — keep the phone login, skip the convenience copy of it.
      [created] = await db.insert(users).values(base).returning();
    }

    if (!created) return fallback;

    return {
      id: created.id,
      email: created.email,
      whatsapp: created.whatsapp,
      name: created.name,
      role: created.role,
      isActive: created.isActive,
      persisted: true,
    };
  } catch {
    // Column missing / database unreachable — keep the stateless session.
    return fallback;
  }
}
