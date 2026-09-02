import { db } from "@/db";
import { categories, coupons, products, ucPackages } from "@/db/schema";
import { getAdminSession } from "@/lib/admin-auth";
import { convertGoogleDriveUrl } from "@/lib/image-utils";
import { asc, desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const jsonError = (message: string, status = 400) =>
  Response.json({ error: message }, { status });

async function requireAdmin(request: NextRequest) {
  return await getAdminSession(request);
}

const normalizeSlug = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) return jsonError("Unauthorized", 401);

  try {
    const [categoryRows, productRows, packageRows, couponRows] = await Promise.all([
      db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
      db.select().from(products).orderBy(asc(products.categorySlug), asc(products.sortOrder), asc(products.createdAt)),
      db.select().from(ucPackages).orderBy(asc(ucPackages.price)),
      db.select().from(coupons).orderBy(desc(coupons.createdAt)),
    ]);

    return Response.json({
      categories: categoryRows,
      products: productRows,
      ucPackages: packageRows,
      coupons: couponRows,
      databaseOnline: true,
    });
  } catch (error) {
    console.error("Admin catalog read failed:", error);
    return jsonError("Database connection failed. Check DATABASE_URL on Vercel.", 503);
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) return jsonError("Unauthorized", 401);

  try {
    const body = await request.json();
    const entity = String(body.entity ?? "");
    const data = body.data ?? {};

    if (entity === "category") {
      const name = String(data.name ?? "").trim();
      const slug = normalizeSlug(data.slug || name);
      const description = String(data.description ?? "").trim();
      const image = convertGoogleDriveUrl(String(data.image ?? ""));
      const sortOrder = Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : 100;

      if (!name || !slug || !image) {
        return jsonError("Category name, URL slug, and image URL are required.");
      }

      const [duplicate] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, slug))
        .limit(1);
      if (duplicate) return jsonError("A category with this URL slug already exists.", 409);

      const [item] = await db
        .insert(categories)
        .values({ name, slug, description, image, sortOrder, isActive: true })
        .returning();
      return Response.json({ item }, { status: 201 });
    }

    if (entity === "product") {
      const categorySlug = normalizeSlug(data.categorySlug);
      const title = String(data.title ?? "").trim();
      const price = Number(data.price);
      const image = convertGoogleDriveUrl(String(data.image ?? ""));
      const features = Array.isArray(data.features)
        ? data.features.map(String).map((x: string) => x.trim()).filter(Boolean)
        : [];
      const sortOrder = Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : 0;

      if (!categorySlug || !title || !image || !Number.isFinite(price) || price < 0) {
        return jsonError("Category, title, valid price, and image URL are required.");
      }

      const [category] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, categorySlug))
        .limit(1);
      if (!category) return jsonError("Selected category does not exist.", 404);

      const [item] = await db
        .insert(products)
        .values({
          categorySlug,
          title,
          price,
          image,
          features,
          badge: data.badge ? String(data.badge).trim() : null,
          sortOrder,
          isActive: true,
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

      const [item] = await db
        .insert(ucPackages)
        .values({
          price,
          ucAmount,
          bonusLabel: data.bonusLabel ? String(data.bonusLabel).trim() : null,
          isActive: true,
        })
        .returning();
      return Response.json({ item }, { status: 201 });
    }

    if (entity === "coupon") {
      const code = String(data.code ?? "").trim().toUpperCase().replace(/\s/g, "");
      const discountValue = Number(data.discountValue);
      if (!code || !Number.isFinite(discountValue) || discountValue <= 0) {
        return jsonError("Coupon code and a valid discount are required.");
      }

      const [item] = await db
        .insert(coupons)
        .values({
          code,
          discountType: data.discountType === "flat" ? "flat" : "percent",
          discountValue,
          usageLimit: data.usageLimit ? Number(data.usageLimit) : null,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          isActive: true,
        })
        .returning();
      return Response.json({ item }, { status: 201 });
    }

    if (entity === "feedback") {
      const name = String(data.name ?? "").trim();
      const review = String(data.review ?? "").trim();
      const rating = Math.max(1, Math.min(5, Number(data.rating ?? 5)));
      const avatar = String(data.avatar ?? "").trim() || null;
      if (!name || !review) return jsonError("Name and review are required.");
      const { feedbacks } = await import("@/db/schema");
      const [item] = await db.insert(feedbacks).values({ name, review, rating, avatar, isActive: true }).returning();
      return Response.json({ item }, { status: 201 });
    }

    return jsonError("Unknown catalog entity.");
  } catch (error) {
    console.error("Admin catalog create failed:", error);
    const message = error instanceof Error && error.message.includes("duplicate")
      ? "This item already exists."
      : "Could not save to the database.";
    return jsonError(message, 500);
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin(request))) return jsonError("Unauthorized", 401);

  try {
    const { entity, id, data } = await request.json();
    if (!id) return jsonError("Missing item id.");

    if (entity === "category") {
      const [current] = await db
        .select({ slug: categories.slug })
        .from(categories)
        .where(eq(categories.id, String(id)))
        .limit(1);
      if (!current) return jsonError("Category not found.", 404);

      const nextSlug = normalizeSlug(data.slug || data.name);
      const name = String(data.name ?? "").trim();
      const image = convertGoogleDriveUrl(String(data.image ?? ""));
      if (!name || !nextSlug || !image) {
        return jsonError("Category name, URL slug, and image URL are required.");
      }

      const [item] = await db
        .update(categories)
        .set({
          name,
          slug: nextSlug,
          description: String(data.description ?? "").trim(),
          image,
          sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : 100,
          isActive: data.isActive !== false,
          updatedAt: new Date(),
        })
        .where(eq(categories.id, String(id)))
        .returning();

      if (current.slug !== nextSlug) {
        await db
          .update(products)
          .set({ categorySlug: nextSlug, updatedAt: new Date() })
          .where(eq(products.categorySlug, current.slug));
      }

      return Response.json({ item });
    }

    if (entity === "product") {
      const categorySlug = normalizeSlug(data.categorySlug);
      const title = String(data.title ?? "").trim();
      const image = convertGoogleDriveUrl(String(data.image ?? ""));
      const price = Number(data.price);
      if (!categorySlug || !title || !image || !Number.isFinite(price) || price < 0) {
        return jsonError("Category, title, valid price, and image URL are required.");
      }

      const [item] = await db
        .update(products)
        .set({
          categorySlug,
          title,
          price,
          image,
          features: Array.isArray(data.features)
            ? data.features.map(String).map((x: string) => x.trim()).filter(Boolean)
            : [],
          badge: data.badge ? String(data.badge).trim() : null,
          sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : 0,
          isActive: data.isActive !== false,
          updatedAt: new Date(),
        })
        .where(eq(products.id, String(id)))
        .returning();
      return Response.json({ item });
    }

    if (entity === "uc") {
      const [item] = await db
        .update(ucPackages)
        .set({
          price: Number(data.price),
          ucAmount: Number(data.ucAmount),
          bonusLabel: data.bonusLabel ? String(data.bonusLabel).trim() : null,
          isActive: data.isActive !== false,
        })
        .where(eq(ucPackages.id, String(id)))
        .returning();
      return Response.json({ item });
    }

    if (entity === "coupon") {
      const [item] = await db
        .update(coupons)
        .set({
          discountType: data.discountType === "flat" ? "flat" : "percent",
          discountValue: Number(data.discountValue),
          usageLimit: data.usageLimit ? Number(data.usageLimit) : null,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          isActive: data.isActive !== false,
        })
        .where(eq(coupons.id, String(id)))
        .returning();
      return Response.json({ item });
    }

    if (entity === "feedback") {
      const { feedbacks } = await import("@/db/schema");
      const [item] = await db
        .update(feedbacks)
        .set({
          name: data.name,
          review: data.review,
          rating: Number(data.rating),
          avatar: data.avatar,
          isActive: data.isActive !== false,
          updatedAt: new Date(),
        })
        .where(eq(feedbacks.id, String(id)))
        .returning();
      return Response.json({ item });
    }

    return jsonError("Unknown catalog entity.");
  } catch (error) {
    console.error("Admin catalog update failed:", error);
    return jsonError("Could not update the database item.", 500);
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin(request))) return jsonError("Unauthorized", 401);

  try {
    const { entity, id } = await request.json();
    if (!id) return jsonError("Missing item id.");

    if (entity === "category") {
      const [current] = await db
        .select({ slug: categories.slug })
        .from(categories)
        .where(eq(categories.id, String(id)))
        .limit(1);
      if (!current) return jsonError("Category not found.", 404);

      await db.delete(products).where(eq(products.categorySlug, current.slug));
      await db.delete(categories).where(eq(categories.id, String(id)));
    } else if (entity === "product") {
      await db.delete(products).where(eq(products.id, String(id)));
    } else if (entity === "uc") {
      await db.delete(ucPackages).where(eq(ucPackages.id, String(id)));
    } else if (entity === "coupon") {
      await db.delete(coupons).where(eq(coupons.id, String(id)));
    } else if (entity === "feedback") {
      const { feedbacks } = await import("@/db/schema");
      await db.delete(feedbacks).where(eq(feedbacks.id, String(id)));
    } else {
      return jsonError("Unknown catalog entity.");
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Admin catalog delete failed:", error);
    return jsonError("Could not delete the database item.", 500);
  }
}
