import "dotenv/config";
import { db } from "@/db";
import { accounts, admins, categories, products, siteSettings, ucPackages } from "@/db/schema";
import { defaultAccounts, defaultCategories, defaultProducts, defaultUcPackages, DEFAULT_CHECKOUT_MODE, DEFAULT_UPI_ID, DEFAULT_WHATSAPP_NUMBER } from "@/lib/store-data";
import { hashPassword } from "@/lib/password";
import { count } from "drizzle-orm";

/**
 * Safe bootstrap for Neon/PostgreSQL.
 *
 * Rules:
 * - Never deletes data.
 * - Never overwrites existing rows.
 * - Seeds default records only when the related table is empty.
 * - Creates the MANAV owner only when the admins table is empty.
 *
 * Run with:
 *   npx tsx src/lib/db-bootstrap.ts
 */
export async function bootstrapDatabase() {
  const summary: Record<string, string | number> = {};

  const [{ value: categoryCount }] = await db.select({ value: count() }).from(categories);
  if (categoryCount === 0) {
    await db.insert(categories).values(
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

  const [{ value: productCount }] = await db.select({ value: count() }).from(products);
  if (productCount === 0) {
    await db.insert(products).values(
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

  const [{ value: accountCount }] = await db.select({ value: count() }).from(accounts);
  if (accountCount === 0) {
    await db.insert(accounts).values(
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

  const [{ value: ucCount }] = await db.select({ value: count() }).from(ucPackages);
  if (ucCount === 0) {
    await db.insert(ucPackages).values(
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

  const [{ value: settingsCount }] = await db.select({ value: count() }).from(siteSettings);
  if (settingsCount === 0) {
    await db.insert(siteSettings).values([
      { settingKey: "whatsapp_number", value: DEFAULT_WHATSAPP_NUMBER },
      { settingKey: "upi_id", value: DEFAULT_UPI_ID },
      { settingKey: "checkout_mode", value: DEFAULT_CHECKOUT_MODE },
    ]);
    summary.siteSettings = 3;
  } else {
    // Ensure new keys exist without overwriting existing ones
    const existingKeys = await db.select({ key: siteSettings.settingKey }).from(siteSettings);
    const keySet = new Set(existingKeys.map((r) => r.key));
    const toInsert: Array<{ settingKey: string; value: string }> = [];
    if (!keySet.has("upi_id")) toInsert.push({ settingKey: "upi_id", value: DEFAULT_UPI_ID });
    if (!keySet.has("checkout_mode")) toInsert.push({ settingKey: "checkout_mode", value: DEFAULT_CHECKOUT_MODE });
    if (!keySet.has("whatsapp_number")) toInsert.push({ settingKey: "whatsapp_number", value: DEFAULT_WHATSAPP_NUMBER });
    if (toInsert.length) {
      await db.insert(siteSettings).values(toInsert as never);
      summary.siteSettings = `preserved ${settingsCount} + seeded ${toInsert.length}`;
    } else {
      summary.siteSettings = `preserved ${settingsCount}`;
    }
  }

  const [{ value: adminCount }] = await db.select({ value: count() }).from(admins);
  if (adminCount === 0) {
    await db.insert(admins).values({
      username: "manav",
      email: "manav@local.admin",
      passwordHash: hashPassword("MANAV7412"),
      role: "owner",
      isActive: true,
    });
    summary.admins = 1;
  } else {
    summary.admins = `preserved ${adminCount}`;
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
