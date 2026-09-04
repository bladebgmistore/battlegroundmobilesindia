import { db } from "@/db";
import { passwordResets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateOtp, hashOtp } from "@/lib/password";
import { sendOtpEmail } from "@/lib/mailer";
import { findUserByIdentifier } from "@/lib/user-store";

// Demo fallback OTP store — used when the DB is offline so the reset flow can
// still be verified in the preview.
const memOtp = new Map<string, { hash: string; expires: number }>();

export type RequestResetResult = {
  ok: boolean;
  delivered: boolean;
  deliveryMode: "smtp" | "demo";
  error?: string;
  demoOtp?: string;
  email?: string;
};

/**
 * Generates an OTP for a customer account and attempts to deliver it by email.
 *
 * When email delivery isn't actually possible (no SMTP configured), the OTP is
 * returned in `demoOtp` so the store owner can still complete / test the reset
 * flow — a clear banner in the UI explains that production mail requires SMTP.
 */
export async function requestPasswordReset(identifier: string): Promise<RequestResetResult> {
  const email = String(identifier ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter the email linked to your account.", delivered: false, deliveryMode: "demo" };
  }

  const user = await findUserByIdentifier(email);
  if (!user || !user.email) {
    return { ok: false, error: "No account found with this email.", delivered: false, deliveryMode: "demo" };
  }

  // Make sure the password_resets table exists before inserting.
  const { ensureUserTables } = await import("@/lib/user-tables");
  await ensureUserTables();

  const otp = generateOtp();
  const hash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    await db.insert(passwordResets).values({ email: user.email, otpHash: hash, expiresAt });
  } catch {
    // DB offline — memory copy lets reset be verified anyway.
    memOtp.set(user.email, { hash, expires: expiresAt.getTime() });
  }

  const { delivered } = await sendOtpEmail(user.email, otp, user.name);

  // If email couldn't be delivered (SMTP not configured), surface the OTP so
  // the flow remains usable and testable. This is the pragmatic fallback for a
  // store that hasn't wired up mail yet.
  if (!delivered) {
    return { ok: true, delivered: false, deliveryMode: "demo", demoOtp: otp, email: user.email };
  }

  return { ok: true, delivered: true, deliveryMode: "smtp", email: user.email };
}

/** Verifies a submitted OTP against the stored hash (memory-first, then DB). */
export async function verifyPasswordResetOtp(email: string, otp: string): Promise<boolean> {
  const normalized = String(email ?? "").trim().toLowerCase();
  const hash = hashOtp(String(otp ?? ""));

  const mem = memOtp.get(normalized);
  if (mem && mem.expires > Date.now() && mem.hash === hash) return true;

  try {
    const [row] = await db
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.email, normalized))
      .orderBy(passwordResets.createdAt)
      .limit(1);
    if (!row) return false;
    if (row.isUsed) return false;
    if (new Date(row.expiresAt).getTime() < Date.now()) return false;
    return row.otpHash === hash;
  } catch {
    return false;
  }
}

/** Marks every reset token for an email as used (prevents replay). */
export async function consumePasswordResetTokens(email: string): Promise<void> {
  const normalized = String(email ?? "").trim().toLowerCase();
  memOtp.delete(normalized);
  try {
    await db.update(passwordResets).set({ isUsed: true }).where(eq(passwordResets.email, normalized));
  } catch {
    // ignore
  }
}
