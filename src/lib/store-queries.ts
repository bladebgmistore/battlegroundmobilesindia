import { db2 } from "@/db";
import { categories, pages } from "@/db/schema";
import { sql } from "drizzle-orm";
import { canonicalCategorySlug, normalizeSlug } from "@/lib/catalog";
import { ensureStoreTables } from "@/lib/store-tables";

/**
 * Small server-side readers used by dynamic route metadata and the `/pages`
 * renderer. They never throw: a database outage returns `null`, and the page
 * falls back to a generic title while the client component shows its retry
 * state.
 */
export async function getStoreCategory(slug: string) {
  try {
    await ensureStoreTables();
    const rows = await db2.execute<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      image: string | null;
      sort_order: number;
      is_active: boolean;
    }>(sql`
      SELECT id, name, slug, description, image, sort_order, is_active
      FROM categories
      WHERE slug = ${slug}
        AND coalesce(is_active, true) = true
      LIMIT 1
    `);

    type CategoryRow = {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      image: string | null;
      sort_order: number;
      is_active: boolean;
    };
    let row: CategoryRow | undefined = rows.rows[0];

    // Legacy imports may store `Supercar` or `X Suite`. Resolve those through
    // the same canonical rules the public API uses instead of silently losing
    // the metadata (and therefore the SEO title/description) for the page.
    if (!row) {
      const all = await db2.execute<CategoryRow>(sql`
        SELECT id, name, slug, description, image, sort_order, is_active
        FROM categories
        WHERE coalesce(is_active, true) = true
      `);
      row = all.rows.find(
        (category) => canonicalCategorySlug(category.slug) === canonicalCategorySlug(slug),
      );
    }

    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      slug: canonicalCategorySlug(row.slug),
      description: row.description ?? "",
      image: row.image ?? "",
      sortOrder: row.sort_order,
      isActive: row.is_active !== false,
    };
  } catch {
    return null;
  }
}

export async function getStorePage(slug: string) {
  try {
    await ensureStoreTables();
    const rows = await db2.execute<{
      id: string;
      title: string;
      slug: string;
      content: string;
      image: string | null;
      show_in_nav: boolean;
      sort_order: number;
      is_active: boolean;
    }>(sql`
      SELECT id, title, slug, content, image, show_in_nav, sort_order, is_active
      FROM pages
      WHERE slug = ${slug}
        AND coalesce(is_active, true) = true
      LIMIT 1
    `);

    type PageRow = {
      id: string;
      title: string;
      slug: string;
      content: string;
      image: string | null;
      show_in_nav: boolean;
      sort_order: number;
      is_active: boolean;
    };
    let row: PageRow | undefined = rows.rows[0];

    // Same tolerance for page slugs created outside the dashboard.
    if (!row) {
      const all = await db2.execute<PageRow>(sql`
        SELECT id, title, slug, content, image, show_in_nav, sort_order, is_active
        FROM pages
        WHERE coalesce(is_active, true) = true
      `);
      row = all.rows.find((page) => normalizeSlug(page.slug) === normalizeSlug(slug));
    }

    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      slug: normalizeSlug(row.slug),
      content: row.content ?? "",
      image: row.image,
      showInNav: Boolean(row.show_in_nav),
      sortOrder: row.sort_order,
      isActive: row.is_active !== false,
    };
  } catch {
    return null;
  }
}
