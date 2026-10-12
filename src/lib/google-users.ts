import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, or, sql } from "drizzle-orm";
import { ensureAuthTables } from "@/lib/auth-tables";
import { resolveLoginRole } from "@/lib/staff";
import type { GoogleProfile } from "@/lib/google-oauth";
import { ensureReferralCode, findReferrerIdByCode, generateUniqueReferralCode } from "@/lib/referrals";

export type AppUser = {
  id: string;
  googleId: string | null;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
  createdAt: string | Date | null;
  lastLoginAt: string | Date | null;
};

/**
 * Create-or-update the local user row for a Google account.
 *
 * Matching order: google_id → email (so accounts created by the old
 * password login are adopted instead of duplicated).
 * The role is recomputed on every sign-in: OWNER_EMAIL env → owner, an
 * active staff_members row → admin/manager/moderator, otherwise customer.
 * Promoting or removing staff therefore never needs a redeploy.
 *
 * Refer & Earn: a NEW account gets its own referral code, and — when it signs
 * up through a referral link — `referred_by` points at the referrer.
 * Existing accounts are never re-attributed.
 */
export async function upsertGoogleUser(
  profile: GoogleProfile,
  options: { referralCode?: string | null } = {},
): Promise<AppUser> {
  const role = await resolveLoginRole(profile.email);
  const fallback: AppUser = {
    id: profile.sub,
    googleId: profile.sub,
    email: profile.email,
    name: profile.name,
    avatarUrl: profile.picture,
    role,
    isActive: true,
    createdAt: new Date(),
    lastLoginAt: new Date(),
  };

  const ready = await ensureAuthTables();
  if (!ready) return fallback; // DB offline — session still works (stateless cookie).

  try {
    const [existing] = await db
      .select()
      .from(users)
      .where(or(eq(users.googleId, profile.sub), eq(users.email, profile.email)))
      .limit(1);

    if (existing) {
      await db
        .update(users)
        .set({
          googleId: profile.sub,
          email: profile.email,
          name: profile.name || existing.name,
          avatarUrl: profile.picture,
          role,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id));

      // Accounts created before Refer & Earn get their code on their next sign-in.
      if (!existing.referralCode) await ensureReferralCode(existing.id).catch(() => null);

      return {
        id: existing.id,
        googleId: profile.sub,
        email: profile.email,
        name: profile.name || existing.name,
        avatarUrl: profile.picture,
        role,
        isActive: existing.isActive,
        createdAt: existing.createdAt,
        lastLoginAt: new Date(),
      };
    }

    const referredBy = await findReferrerIdByCode(options.referralCode);
    const referralCode = await generateUniqueReferralCode().catch(() => null);

    const [created] = await db
      .insert(users)
      .values({
        email: profile.email,
        name: profile.name,
        googleId: profile.sub,
        avatarUrl: profile.picture,
        role,
        isActive: true,
        lastLoginAt: new Date(),
        referralCode,
        referredBy,
      })
      .returning();

    return {
      id: created.id,
      googleId: created.googleId ?? profile.sub,
      email: created.email ?? profile.email,
      name: created.name,
      avatarUrl: created.avatarUrl ?? profile.picture,
      role: created.role,
      isActive: created.isActive,
      createdAt: created.createdAt,
      lastLoginAt: created.lastLoginAt ?? new Date(),
    };
  } catch {
    return fallback;
  }
}

/** All signed-in users, newest first — powers the admin "Users" table. */
export async function listUsers(limit = 200): Promise<AppUser[]> {
  const ready = await ensureAuthTables();
  if (!ready) return [];
  try {
    const rows = await db
      .select({
        id: users.id,
        googleId: users.googleId,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .orderBy(sql`${users.lastLoginAt} DESC NULLS LAST`)
      .limit(limit);
    return rows.map((row) => ({ ...row, email: row.email ?? "" }));
  } catch {
    return [];
  }
}
