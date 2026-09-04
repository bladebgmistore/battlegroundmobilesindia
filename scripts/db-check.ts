/**
 * Local end-to-end check of every query the admin panel makes at runtime,
 * against the real Neon database (same code path as /api/admin/catalog).
 *
 * Run:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/db-check.ts
 *
 * Note: this script should NEVER be run on the build machine (Netlify) —
 * it is a local diagnostic only. It returns a non-zero exit code on failure.
 */
import { db } from "../src/db";
import {
  accounts,
  admins,
  adminSessions,
  categories,
  coupons,
  customerMessages,
  feedback,
  feedbacks,
  orders,
  products,
  siteSettings,
  ucPackages,
} from "../src/db/schema";
import { asc, desc, eq, inArray } from "drizzle-orm";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) {
    console.error("❌ DATABASE_URL is not set. Usage: DATABASE_URL=\"postgresql://...\" npx tsx scripts/db-check.ts");
    process.exit(2);
  }
  console.log(`ℹ  Host: ${new URL(url).host}`);

  const tableChecks: [string, () => Promise<unknown>][] = [
    ["categories", () => db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name))],
    ["products", () => db.select().from(products).orderBy(asc(products.categorySlug))],
    ["uc_packages", () => db.select().from(ucPackages).orderBy(asc(ucPackages.price))],
    ["coupons", () => db.select().from(coupons).orderBy(desc(coupons.createdAt))],
    ["accounts", () => db.select().from(accounts)],
    ["orders", () => db.select().from(orders)],
    ["customer_messages", () => db.select().from(customerMessages).orderBy(desc(customerMessages.createdAt)).limit(5)],
    ["site_settings", () => db.select().from(siteSettings)],
    ["admins", () => db.select().from(admins).where(eq(admins.username, "manav")).limit(1)],
    ["feedback", () => db.select().from(feedback)],
    ["feedbacks", () => db.select().from(feedbacks)],
    ["admin_sessions (legacy only)", () => db.select().from(adminSessions).limit(1)],
  ];

  let failed = 0;
  for (const [name, fn] of tableChecks) {
    try {
      const rows = (await fn()) as unknown[];
      console.log(`✅ ${name.padEnd(26)} -> ${rows.length} row(s)`);
    } catch (err) {
      failed += 1;
      console.error(`❌ ${name.padEnd(26)} -> ${(err as Error).message.split("\n")[0]}`);
    }
  }

  // Simulate the exact /api/store settings query used by the storefront.
  try {
    const keys = [
      "whatsapp_number", "instagram_url", "youtube_url", "maintenance_mode",
      "homepage_headline", "logo_url", "upi_id", "checkout_mode",
      "featured_drop_label", "featured_drop_title", "featured_drop_image",
    ];
    const rows = await db
      .select()
      .from(siteSettings)
      .where(inArray(siteSettings.settingKey, keys));
    console.log(`✅ site_settings (public keys)     -> ${rows.length} row(s)`);
  } catch (err) {
    failed += 1;
    console.error(`❌ site_settings (public keys)     -> ${(err as Error).message.split("\n")[0]}`);
  }

  console.log(failed === 0 ? "\n🎉 ALL DB CHECKS PASSED — DB aur schema dono theek hain." : `\n⚠️  ${failed} check(s) FAILED — niche error detail carefully padhein.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
