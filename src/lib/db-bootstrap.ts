import "dotenv/config";
import { db2 } from "@/db";
import { accounts, categories, products, siteSettings, ucPackages } from "@/db/schema";
import { defaultAccounts, defaultCategories, defaultProducts, defaultUcPackages, DEFAULT_CHECKOUT_MODE, DEFAULT_UPI_ID, DEFAULT_WHATSAPP_NUMBER } from "@/lib/store-data";
import { count } from "drizzle-orm";
import { ensureAuthTables } from "@/lib/auth-tables";
import { ensureStoreTables } from "@/lib/store-tables";
import { ensureStaffTables } from "@/lib/staff";
import { ensureOrderColumns } from "@/lib/order-columns";
import { ensureSupportTables } from "@/lib/support-tables";
import { ensureNotificationTables } from "@/lib/notification-tables";
import { ensureProofTables } from "@/lib/proof-tables";
import { ensureReferralTables } from "@/lib/referral-tables";

/**
 * Safe bootstrap for Neon/PostgreSQL — 3-database setup.
 * DB2 holds all inventory/site-settings tables.
 */
export async function bootstrapDatabase() {
  const summary: Record<string, string | number | Record<string, string>> = {};

  // ── 1. Provision every table in its own database (idempotent) ───────────
  // DB1: users, staff, visitor logs. DB2: inventory + settings. DB3: orders,
  // support, notifications, proofs and the rewards ledger.
  const [db1Ready, db2Ready, db3Orders] = await Promise.all([
    ensureAuthTables(),
    ensureStoreTables(),
    ensureOrderColumns(),
  ]);
  await ensureStaffTables();
  const [supportReady, notificationReady, proofReady, referralReady] = await Promise.all([
    ensureSupportTables(),
    ensureNotificationTables(),
    ensureProofTables(),
    ensureReferralTables(),
  ]);
  summary.tables = {
    db1: db1Ready ? "ready" : "skipped (database offline)",
    db2: db2Ready ? "ready" : "skipped (database offline)",
    db3: db3Orders && supportReady && notificationReady && proofReady && referralReady ? "ready" : "partially ready",
  };

  const [{ value: categoryCount }] = await db2.select({ value: count() }).from(categories);
  if (categoryCount === 0) {
    await db2.insert(categories).values(
      defaultCategories.map((category) => ({
        name: category.name,
        slug: category.slug,
        description: category.description,
        image: category.image,
        sortOrder: category.sortOrder ?? 100,
        isActive: true,
      })),
    );
    summary.categories = defaultCategories.length;
  } else {
    summary.categories = `preserved ${categoryCount}`;
  }

  const [{ value: productCount }] = await db2.select({ value: count() }).from(products);
  if (productCount === 0) {
    await db2.insert(products).values(
      defaultProducts.map((product) => ({
        categorySlug: product.categorySlug,
        title: product.title,
        price: product.price,
        image: product.image,
        features: product.features,
        badge: product.badge ?? null,
        sortOrder: product.sortOrder ?? 0,
        isActive: true,
      })),
    );
    summary.products = defaultProducts.length;
  } else {
    summary.products = `preserved ${productCount}`;
  }

  const [{ value: accountCount }] = await db2.select({ value: count() }).from(accounts);
  if (accountCount === 0) {
    await db2.insert(accounts).values(
      defaultAccounts.map((account) => ({
        title: account.title,
        price: account.price,
        image: account.image,
        features: account.features,
        badge: account.badge ?? null,
        isActive: true,
      })),
    );
    summary.accounts = defaultAccounts.length;
  } else {
    summary.accounts = `preserved ${accountCount}`;
  }

  const [{ value: ucCount }] = await db2.select({ value: count() }).from(ucPackages);
  if (ucCount === 0) {
    await db2.insert(ucPackages).values(
      defaultUcPackages.map((pack) => ({
        price: pack.price,
        ucAmount: pack.ucAmount,
        bonusLabel: pack.bonusLabel ?? null,
        isActive: true,
      })),
    );
    summary.ucPackages = defaultUcPackages.length;
  } else {
    summary.ucPackages = `preserved ${ucCount}`;
  }

  const [{ value: settingsCount }] = await db2.select({ value: count() }).from(siteSettings);
  if (settingsCount === 0) {
    await db2.insert(siteSettings).values([
      { settingKey: "whatsapp_number", value: DEFAULT_WHATSAPP_NUMBER },
      { settingKey: "whatsapp_enabled", value: "false" },
      { settingKey: "upi_id", value: DEFAULT_UPI_ID },
      { settingKey: "checkout_mode", value: DEFAULT_CHECKOUT_MODE },
    ]);
    summary.siteSettings = 4;
  } else {
    const existingKeys = await db2.select({ key: siteSettings.settingKey }).from(siteSettings);
    const keySet = new Set(existingKeys.map((r) => r.key));
    const toInsert: Array<{ settingKey: string; value: string }> = [];
    if (!keySet.has("upi_id")) toInsert.push({ settingKey: "upi_id", value: DEFAULT_UPI_ID });
    if (!keySet.has("checkout_mode")) toInsert.push({ settingKey: "checkout_mode", value: DEFAULT_CHECKOUT_MODE });
    if (!keySet.has("whatsapp_number")) toInsert.push({ settingKey: "whatsapp_number", value: DEFAULT_WHATSAPP_NUMBER });
    if (!keySet.has("whatsapp_enabled")) toInsert.push({ settingKey: "whatsapp_enabled", value: "false" });
    if (toInsert.length) {
      await db2.insert(siteSettings).values(toInsert as never);
      summary.siteSettings = `preserved ${settingsCount} + seeded ${toInsert.length}`;
    } else {
      summary.siteSettings = `preserved ${settingsCount}`;
    }
  }

  return summary;
}

if (process.argv[1]?.endsWith("db-bootstrap.ts")) {
  bootstrapDatabase()
    .then((summary) => {
      console.log("Database bootstrap complete:", summary);
    })
    .catch((error) => {
      console.error("Database bootstrap failed:", error);
      process.exitCode = 1;
    });
}
