import { db2 } from "@/db";
import { categories, coupons, pages, products, ucPackages } from "@/db/schema";
import { requireAdminScope } from "@/lib/admin-auth";
import { canonicalCategorySlug, normalizeSlug } from "@/lib/catalog";
import { convertGoogleDriveUrl } from "@/lib/image-utils";
import { ensureStoreTables } from "@/lib/store-tables";
import { FALLBACK_IMAGE, type Category, type Product, type StorePage, type UcPackageItem } from "@/lib/store-data";
import { asc, desc, eq, ne, and, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const jsonError = (message: string, status = 400) => Response.json({ error: message }, { status });

async function requireAdmin(request: NextRequest) {
  // Catalog management: owner / admin / manager.
  return await requireAdminScope(request, "catalog");
}

type Payload = Record<string, unknown>;

const text = (value: unknown): string => String(value ?? "").trim();

const normalizeImage = (value: unknown): string => {
  const raw = text(value);
  if (!raw) return FALLBACK_IMAGE;
  return convertGoogleDriveUrl(raw) || FALLBACK_IMAGE;
};

const normalizeOptionalImage = (value: unknown): string | null => {
  const raw = text(value);
  if (!raw) return null;
  return convertGoogleDriveUrl(raw) || null;
};


/**
 * Resolve a category by slug, accepting legacy spellings.
 *
 * An imported database may contain `Supercar` or `Xsuite` while the form sends
 * `super-cars` / `x-suits`. An exact-match lookup rejected those writes with
 * "Selected category does not exist", so products could be marked published in
 * the dashboard but never land in the public catalog. The canonical comparison
 * keeps both representations attached to the same category.
 */
async function resolveCategory(slug: string) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;

  const [exact] = await db2
    .select()
    .from(categories)
    .where(eq(categories.slug, normalized))
    .limit(1);
  if (exact) return exact;

  const rows = await db2.select().from(categories);
  const canonical = canonicalCategorySlug(normalized);
  return rows.find((row) => canonicalCategorySlug(row.slug) === canonical) ?? null;
}

/** Defaults for the four built-in storefront collections. */
const KNOWN_CATEGORY_DEFAULTS: Record<
  string,
  { name: string; description: string; sortOrder: number }
> = {
  accounts: {
    name: "Premium Accounts",
    description: "Find the high-tier BGMI account that matches your play style.",
    sortOrder: 10,
  },
  uc: {
    name: "UC Purchase",
    description: "High-value UC packages for your next BGMI upgrade.",
    sortOrder: 20,
  },
  "super-cars": {
    name: "Super Cars",
    description: "Premium limited-edition supercars with specialised card packs.",
    sortOrder: 30,
  },
  "x-suits": {
    name: "X-Suits",
    description: "Legendary BGMI X-Suits with secure guided delivery.",
    sortOrder: 40,
  },
};

/**
 * Resolve a category, recreating one of the four built-in collections if its
 * row was lost by a database import. This lets an admin publish stock even on
 * a half-repaired database instead of hitting "Selected category does not
 * exist" from a tab that visibly exists in the dashboard.
 */
async function ensureCatalogCategory(slug: string) {
  const existing = await resolveCategory(slug);
  if (existing) return existing;

  const canonical = canonicalCategorySlug(slug);
  const preset = KNOWN_CATEGORY_DEFAULTS[canonical];
  if (!preset) return null;

  await db2
    .insert(categories)
    .values({
      name: preset.name,
      slug: canonical,
      description: preset.description,
      image: FALLBACK_IMAGE,
      sortOrder: preset.sortOrder,
      isActive: true,
    })
    .onConflictDoNothing();

  return resolveCategory(canonical);
}

const parsePrice = (value: unknown): number => Number(value);

const parseFeatures = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split("\n").map((item) => item.trim()).filter(Boolean);
  return [];
};

const parseBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "published", "active", "live", "visible"].includes(normalized)) return true;
    if (["false", "0", "no", "draft", "inactive", "hidden", "unpublished"].includes(normalized)) return false;
  }
  if (typeof value === "number") return value !== 0;
  return fallback;
};

/**
 * Publish semantics.
 *
 * The dashboard historically used `isActive`, while other clients (and the
 * product brief) use `isPublished`. Both are accepted; `isPublished` wins when
 * both are present, and the value is persisted in the canonical `is_active`
 * column. When neither key is supplied the current value is preserved — a
 * partial PATCH can never silently republish a hidden product.
 */
const publishFlag = (data: Payload, fallback: boolean): boolean => {
  if (data.isPublished !== undefined) return parseBoolean(data.isPublished, fallback);
  if (data.isActive !== undefined) return parseBoolean(data.isActive, fallback);
  return fallback;
};

const normalizeSort = (value: unknown, fallback: number): number =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

/* ─────────────────────────────── GET ─────────────────────────────────────── */

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) return jsonError("Unauthorized", 401);
  await ensureStoreTables();

  try {
    const [categoryRows, productRows, packageRows, pageRows, couponRows] = await Promise.all([
      db2.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
      db2.select().from(products).orderBy(asc(products.categorySlug), asc(products.sortOrder), asc(products.createdAt)),
      db2.select().from(ucPackages).orderBy(asc(ucPackages.price)),
      db2.select().from(pages).orderBy(asc(pages.sortOrder), asc(pages.title)),
      db2.select().from(coupons).orderBy(desc(coupons.createdAt)),
    ]);

    // Normalise NULL flags from older imports so the admin UI can toggle them.
    return Response.json({
      categories: categoryRows.map((category): Category => ({
        ...category,
        description: category.description ?? "",
        image: category.image ?? "",
        isActive: category.isActive !== false,
        isPublished: category.isActive !== false,
      })),
      products: productRows.map((product): Product => ({
        ...product,
        features: Array.isArray(product.features) ? product.features : [],
        isActive: product.isActive !== false,
        isPublished: product.isActive !== false,
      })),
      ucPackages: packageRows.map((pack): UcPackageItem => ({
        ...pack,
        isActive: pack.isActive !== false,
        isPublished: pack.isActive !== false,
      })),
      pages: pageRows.map((page): StorePage => ({
        ...page,
        content: page.content ?? "",
        showInNav: Boolean(page.showInNav),
        isActive: page.isActive !== false,
        isPublished: page.isActive !== false,
      })),
      coupons: couponRows,
      databaseOnline: true,
    });
  } catch (error) {
    console.error("Admin catalog read failed:", error);
    return jsonError(
      "Database connection failed. Ensure DATABASE_URL_DB1, DATABASE_URL_DB2 and DATABASE_URL_DB3 are configured (see .env.example).",
      503,
    );
  }
}

/* ─────────────────────────────── POST ────────────────────────────────────── */

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) return jsonError("Unauthorized", 401);
  await ensureStoreTables();

  try {
    const body = await request.json();
    const entity = String(body.entity ?? "");
    const data = (body.data ?? {}) as Payload;

    if (entity === "category") {
      const name = text(data.name);
      const slug = canonicalCategorySlug(normalizeSlug(data.slug || name));
      const description = text(data.description);
      const image = normalizeImage(data.image);
      const sortOrder = normalizeSort(data.sortOrder, 100);
      const isActive = publishFlag(data, true);

      if (!name || !slug) return jsonError("Category name is required.");
      if (slug.length > 100) return jsonError("Category URL slug must be 100 characters or fewer.");

      const existingCategories = await db2.select({ id: categories.id, slug: categories.slug }).from(categories);
      const duplicate = existingCategories.find(
        (category) => canonicalCategorySlug(category.slug) === canonicalCategorySlug(slug),
      );
      if (duplicate) return jsonError("A category with this URL slug already exists.", 409);

      const [item] = await db2
        .insert(categories)
        .values({ name, slug, description, image, sortOrder, isActive })
        .returning();
      return Response.json({ item }, { status: 201 });
    }

    if (entity === "product") {
      const requestedCategorySlug = normalizeSlug(data.categorySlug);
      const title = text(data.title);
      const price = parsePrice(data.price);
      const image = normalizeImage(data.image);
      const features = parseFeatures(data.features);
      const sortOrder = normalizeSort(data.sortOrder, 0);
      const isActive = publishFlag(data, true);

      if (!requestedCategorySlug || !title || !Number.isFinite(price) || price < 0) {
        return jsonError("Category, title and a valid price are required.");
      }

      const category = await ensureCatalogCategory(requestedCategorySlug);
      if (!category) return jsonError("Selected category does not exist.", 404);

      // Persist the canonical slug so the storefront, cart and category routes
      // all resolve to the same key even when the category row predates the
      // normalisation rules.
      const categorySlug = canonicalCategorySlug(requestedCategorySlug);

      const [item] = await db2
        .insert(products)
        .values({
          categorySlug,
          title,
          price,
          image,
          features,
          badge: text(data.badge) || null,
          sortOrder,
          isActive,
        })
        .returning();
      return Response.json({ item }, { status: 201 });
    }

    if (entity === "uc") {
      const price = Number(data.price);
      const ucAmount = Number(data.ucAmount);
      if (!Number.isFinite(price) || price < 0 || !Number.isFinite(ucAmount) || ucAmount <= 0) {
        return jsonError("Valid price and UC amount are required.");
      }

      // UC packages are only exposed publicly while the `uc` category exists
      // and is active. Creating a bundle on a database whose category row was
      // lost must not leave the package permanently invisible.
      await ensureCatalogCategory("uc");

      const [item] = await db2
        .insert(ucPackages)
        .values({
          price,
          ucAmount,
          bonusLabel: text(data.bonusLabel) || null,
          isActive: publishFlag(data, true),
        })
        .returning();
      return Response.json({ item }, { status: 201 });
    }

    if (entity === "page") {
      const title = text(data.title);
      const slug = normalizeSlug(data.slug || title);
      const content = String(data.content ?? "").trim();
      const image = normalizeOptionalImage(data.image);
      const showInNav = parseBoolean(data.showInNav, false);
      const sortOrder = normalizeSort(data.sortOrder, 100);
      const isActive = publishFlag(data, true);

      if (!title || !slug) return jsonError("Page title is required.");
      if (slug.length > 120) return jsonError("Page URL slug must be 120 characters or fewer.");

      const [duplicate] = await db2
        .select({ id: pages.id })
        .from(pages)
        .where(eq(pages.slug, slug))
        .limit(1);
      if (duplicate) return jsonError("A page with this URL slug already exists.", 409);

      const [item] = await db2
        .insert(pages)
        .values({ title, slug, content, image, showInNav, sortOrder, isActive })
        .returning();
      return Response.json({ item }, { status: 201 });
    }

    if (entity === "coupon") {
      const code = text(data.code).toUpperCase().replace(/\s/g, "");
      const discountValue = Number(data.discountValue);
      if (!code || !Number.isFinite(discountValue) || discountValue <= 0) {
        return jsonError("Coupon code and a valid discount are required.");
      }

      const [item] = await db2
        .insert(coupons)
        .values({
          code,
          discountType: data.discountType === "flat" ? "flat" : "percent",
          discountValue,
          usageLimit: data.usageLimit ? Number(data.usageLimit) : null,
          expiresAt: data.expiresAt ? new Date(String(data.expiresAt)) : null,
          isActive: publishFlag(data, true),
        })
        .returning();
      return Response.json({ item }, { status: 201 });
    }

    if (entity === "feedback") {
      const name = text(data.name);
      const review = text(data.review);
      const rating = Math.max(1, Math.min(5, Number(data.rating ?? 5)));
      const avatar = text(data.avatar) || null;
      if (!name || !review) return jsonError("Name and review are required.");
      const { feedbacks } = await import("@/db/schema");
      const [item] = await db2
        .insert(feedbacks)
        .values({ name, review, rating, avatar, isActive: true })
        .returning();
      return Response.json({ item }, { status: 201 });
    }

    return jsonError("Unknown catalog entity.");
  } catch (error) {
    console.error("Admin catalog create failed:", error);
    const message =
      error instanceof Error && /duplicate|unique/i.test(error.message)
        ? "This item already exists."
        : "Could not save to the database.";
    return jsonError(message, 500);
  }
}

/* ─────────────────────────────── PATCH ───────────────────────────────────── */

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin(request))) return jsonError("Unauthorized", 401);
  await ensureStoreTables();

  try {
    const body = await request.json();
    const entity = String(body.entity ?? "");
    const id = String(body.id ?? "");
    const data = (body.data ?? {}) as Payload;
    if (!id) return jsonError("Missing item id.");

    if (entity === "category") {
      const [current] = await db2.select().from(categories).where(eq(categories.id, id)).limit(1);
      if (!current) return jsonError("Category not found.", 404);

      const name = data.name !== undefined ? text(data.name) : current.name;
      const slug =
        data.slug !== undefined
          ? canonicalCategorySlug(normalizeSlug(data.slug))
          : canonicalCategorySlug(current.slug);
      const description = data.description !== undefined ? text(data.description) : (current.description ?? "");
      const image = data.image !== undefined ? normalizeImage(data.image) : (current.image || FALLBACK_IMAGE);
      const sortOrder = data.sortOrder !== undefined ? normalizeSort(data.sortOrder, current.sortOrder) : current.sortOrder;
      const isActive = publishFlag(data, current.isActive !== false);

      if (!name || !slug) return jsonError("Category name is required.");
      if (slug.length > 100) return jsonError("Category URL slug must be 100 characters or fewer.");

      if (canonicalCategorySlug(slug) !== canonicalCategorySlug(current.slug)) {
        const siblings = await db2.select({ id: categories.id, slug: categories.slug }).from(categories);
        const duplicate = siblings.find(
          (category) =>
            category.id !== id && canonicalCategorySlug(category.slug) === canonicalCategorySlug(slug),
        );
        if (duplicate) return jsonError("Another category already uses this URL slug.", 409);
      }

      const [item] = await db2
        .update(categories)
        .set({ name, slug, description, image, sortOrder, isActive, updatedAt: new Date() })
        .where(eq(categories.id, id))
        .returning();

      if (canonicalCategorySlug(current.slug) !== canonicalCategorySlug(slug)) {
        // Keep the product catalog attached when the public URL changes. Match
        // every legacy spelling of the old slug (`Supercar`, `super_car`, …),
        // not just the exact string stored on the category row.
        const previousCanonical = canonicalCategorySlug(current.slug);
        const allProducts = await db2.select({ id: products.id, categorySlug: products.categorySlug }).from(products);
        const affected = allProducts
          .filter((row) => canonicalCategorySlug(row.categorySlug) === previousCanonical)
          .map((row) => row.id);
        if (affected.length > 0) {
          await db2
            .update(products)
            .set({ categorySlug: canonicalCategorySlug(slug), updatedAt: new Date() })
            .where(inArray(products.id, affected));
        }
      }

      return Response.json({ item: { ...item, isPublished: item.isActive !== false } });
    }

    if (entity === "product") {
      const [current] = await db2.select().from(products).where(eq(products.id, id)).limit(1);
      if (!current) return jsonError("Product not found.", 404);

      const title = data.title !== undefined ? text(data.title) : current.title;
      const requestedCategorySlug =
        data.categorySlug !== undefined ? normalizeSlug(data.categorySlug) : current.categorySlug;
      const price = data.price !== undefined ? parsePrice(data.price) : current.price;
      const image = data.image !== undefined ? normalizeImage(data.image) : current.image;
      const features = data.features !== undefined ? parseFeatures(data.features) : (current.features ?? []);
      const badge = data.badge !== undefined ? (text(data.badge) || null) : current.badge;
      const sortOrder = data.sortOrder !== undefined ? normalizeSort(data.sortOrder, current.sortOrder) : current.sortOrder;
      const isActive = publishFlag(data, current.isActive !== false);

      if (!title || !requestedCategorySlug) return jsonError("Category and product title are required.");
      if (!Number.isFinite(price) || price < 0) return jsonError("A valid price is required.");

      const categorySlug = canonicalCategorySlug(requestedCategorySlug);
      if (categorySlug !== canonicalCategorySlug(current.categorySlug)) {
        const category = await ensureCatalogCategory(categorySlug);
        if (!category) return jsonError("Selected category does not exist.", 404);
      }

      const [item] = await db2
        .update(products)
        .set({ categorySlug, title, price, image, features, badge, sortOrder, isActive, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();
      return Response.json({ item: { ...item, isPublished: item.isActive !== false } });
    }

    if (entity === "uc") {
      const [current] = await db2.select().from(ucPackages).where(eq(ucPackages.id, id)).limit(1);
      if (!current) return jsonError("UC package not found.", 404);

      const price = data.price !== undefined ? Number(data.price) : current.price;
      const ucAmount = data.ucAmount !== undefined ? Number(data.ucAmount) : current.ucAmount;
      if (!Number.isFinite(price) || price < 0 || !Number.isFinite(ucAmount) || ucAmount <= 0) {
        return jsonError("Valid price and UC amount are required.");
      }

      const [item] = await db2
        .update(ucPackages)
        .set({
          price,
          ucAmount,
          bonusLabel: data.bonusLabel !== undefined ? (text(data.bonusLabel) || null) : current.bonusLabel,
          isActive: publishFlag(data, current.isActive !== false),
        })
        .where(eq(ucPackages.id, id))
        .returning();
      return Response.json({ item: { ...item, isPublished: item.isActive !== false } });
    }

    if (entity === "page") {
      const [current] = await db2.select().from(pages).where(eq(pages.id, id)).limit(1);
      if (!current) return jsonError("Page not found.", 404);

      const title = data.title !== undefined ? text(data.title) : current.title;
      const slug = data.slug !== undefined ? normalizeSlug(data.slug) : current.slug;
      const content = data.content !== undefined ? String(data.content).trim() : current.content;
      const image = data.image !== undefined ? normalizeOptionalImage(data.image) : current.image;
      const showInNav = data.showInNav !== undefined ? parseBoolean(data.showInNav, current.showInNav) : current.showInNav;
      const sortOrder = data.sortOrder !== undefined ? normalizeSort(data.sortOrder, current.sortOrder) : current.sortOrder;
      const isActive = publishFlag(data, current.isActive !== false);

      if (!title || !slug) return jsonError("Page title is required.");
      if (slug.length > 120) return jsonError("Page URL slug must be 120 characters or fewer.");

      if (slug !== current.slug) {
        const [duplicate] = await db2
          .select({ id: pages.id })
          .from(pages)
          .where(and(eq(pages.slug, slug), ne(pages.id, id)))
          .limit(1);
        if (duplicate) return jsonError("Another page already uses this URL slug.", 409);
      }

      const [item] = await db2
        .update(pages)
        .set({ title, slug, content, image, showInNav, sortOrder, isActive, updatedAt: new Date() })
        .where(eq(pages.id, id))
        .returning();
      return Response.json({ item: { ...item, isPublished: item.isActive !== false } });
    }

    if (entity === "coupon") {
      const [current] = await db2.select().from(coupons).where(eq(coupons.id, id)).limit(1);
      if (!current) return jsonError("Coupon not found.", 404);

      const [item] = await db2
        .update(coupons)
        .set({
          discountType: data.discountType !== undefined ? (data.discountType === "flat" ? "flat" : "percent") : current.discountType,
          discountValue: data.discountValue !== undefined ? Number(data.discountValue) : current.discountValue,
          usageLimit: data.usageLimit !== undefined ? (data.usageLimit ? Number(data.usageLimit) : null) : current.usageLimit,
          expiresAt: data.expiresAt !== undefined ? (data.expiresAt ? new Date(String(data.expiresAt)) : null) : current.expiresAt,
          isActive: publishFlag(data, current.isActive !== false),
        })
        .where(eq(coupons.id, id))
        .returning();
      return Response.json({ item });
    }

    if (entity === "feedback") {
      const { feedbacks } = await import("@/db/schema");
      const [current] = await db2.select().from(feedbacks).where(eq(feedbacks.id, id)).limit(1);
      if (!current) return jsonError("Feedback not found.", 404);

      const [item] = await db2
        .update(feedbacks)
        .set({
          name: data.name !== undefined ? text(data.name) : current.name,
          review: data.review !== undefined ? text(data.review) : current.review,
          rating: data.rating !== undefined ? Number(data.rating) : current.rating,
          avatar: data.avatar !== undefined ? text(data.avatar) : current.avatar,
          isActive: publishFlag(data, current.isActive !== false),
          updatedAt: new Date(),
        })
        .where(eq(feedbacks.id, id))
        .returning();
      return Response.json({ item });
    }

    return jsonError("Unknown catalog entity.");
  } catch (error) {
    console.error("Admin catalog update failed:", error);
    const message =
      error instanceof Error && /duplicate|unique/i.test(error.message)
        ? "Another item already uses this value."
        : "Could not update the database item.";
    return jsonError(message, 500);
  }
}

/* ─────────────────────────────── DELETE ──────────────────────────────────── */

export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin(request))) return jsonError("Unauthorized", 401);
  await ensureStoreTables();

  try {
    const body = await request.json();
    const entity = String(body.entity ?? "");
    const id = String(body.id ?? "");
    if (!id) return jsonError("Missing item id.");

    if (entity === "category") {
      const [current] = await db2
        .select({ slug: categories.slug })
        .from(categories)
        .where(eq(categories.id, id))
        .limit(1);
      if (!current) return jsonError("Category not found.", 404);

      // Delete every product attached to the category, including rows imported
      // with a legacy spelling of the same slug.
      const currentCanonical = canonicalCategorySlug(current.slug);
      const attached = await db2.select({ id: products.id, categorySlug: products.categorySlug }).from(products);
      const attachedIds = attached
        .filter((product) => canonicalCategorySlug(product.categorySlug) === currentCanonical)
        .map((product) => product.id);
      if (attachedIds.length > 0) {
        await db2.delete(products).where(inArray(products.id, attachedIds));
      }
      await db2.delete(categories).where(eq(categories.id, id));
    } else if (entity === "product") {
      await db2.delete(products).where(eq(products.id, id));
    } else if (entity === "uc") {
      await db2.delete(ucPackages).where(eq(ucPackages.id, id));
    } else if (entity === "page") {
      await db2.delete(pages).where(eq(pages.id, id));
    } else if (entity === "coupon") {
      await db2.delete(coupons).where(eq(coupons.id, id));
    } else if (entity === "feedback") {
      const { feedbacks } = await import("@/db/schema");
      await db2.delete(feedbacks).where(eq(feedbacks.id, id));
    } else {
      return jsonError("Unknown catalog entity.");
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Admin catalog delete failed:", error);
    return jsonError("Could not delete the database item.", 500);
  }
}
