# Catalog sync fix — root causes, changes and deploy steps

This document describes the three reported failures and exactly what changed to
fix them. All code changes are on the `arena/875e4046-battlegroundmobilesindia`
branch.

---

## 1. Categories vanished from the public storefront after a database update

### Root causes found

1. **`NULL` publish flags.** The public query filtered `WHERE is_active = true`.
   A column added by an import/update without a backfill leaves existing rows at
   `NULL`, which never matches `= true`. The admin panel normalises with
   `isActive !== false`, so the same rows still looked present there — exactly
   the reported asymmetry.
2. **All-or-nothing catalog read.** `/api/store` executed all five queries in a
   single `try`/`catch`-style flow. One failing table (or one missing DB env
   var, which throws synchronously from the lazy client proxy) replaced the
   entire response with empty arrays. The header then rendered an empty menu.
3. **Hard-coded navigation.** The header/footer only knew four slugs and only
   rendered a link when the API returned that exact slug. A renamed or
   newly created category had no route and no menu entry.
4. **CDN caching.** `/api/store` was previously cacheable, so a re-enabled
   category could stay invisible after a database write.
5. **Legacy inventory stranded.** The old single-database build kept accounts
   in `accounts` and supercar/X-Suit rows in `special_products`; those rows were
   never migrated into the unified `products` table, so their categories looked
   empty even though stock existed.

### Fixes

- `src/lib/store-tables.ts`
  - Always creates missing tables, then (version-gated) adds missing columns,
    backfills `NULL is_active` to `true`, honours legacy
    `is_published`/`status` columns, migrates `accounts` + `special_products`
    into `products`, normalises known legacy category keys and creates an
    orphan category for every remaining product slug.
  - Repair order is: ALTER → legacy publish sync → NULL backfill → inventory
    migration → slug normalisation → orphan repair → indexes.
  - The repair version marker is stored in
    `site_settings.catalog_schema_version` (`2026-10-catalog-sync-3`). Bump it
    whenever a new repair step is added.
- `src/app/api/store/route.ts`
  - Reads categories/products/UC/pages/settings independently with
    `Promise.allSettled`; a partial failure degrades gracefully and reports the
    failing section in `warnings`.
  - Uses `coalesce(is_active, true)` everywhere, normalises slugs, deduplicates
    categories that canonicalise to the same slug, and returns `503` only when
    every read failed (or opt-in demo data when `STORE_DEMO_CATALOG=1` and not
    production).
  - `no-store` response headers (also configured in `next.config.ts`).
- `src/lib/catalog.ts` (new)
  - One source of truth for slug normalisation/aliases, category URLs, page
    URLs, labels, sort order and visibility.
  - `NULL`/`undefined` flags count as visible; only explicit `false` hides.
- `src/lib/use-store-catalog.ts` (new)
  - One shared client cache for `/api/store`; every storefront component reads
    the same snapshot and keeps the last good snapshot if a refresh fails.
- `sql/007_catalog_sync_repair.sql` (new)
  - Idempotent, auditable version of the same repair for deploys.

---

## 2. Page creation leaked into categories; new pages/categories never rendered

### Root causes found

- There was **no pages table and no page route**. Grep for
  `pages`/`createPage`/`site_pages` in the original source returned nothing;
  editorial pages only existed as hard-coded content in
  `src/components/info-pages.tsx`.
- The catalog navigation in `src/components/site-chrome.tsx` was a hard-coded
  four-slug list, so anything created later had no menu entry.

### Fixes

- New `pages` table in `src/db/schemas/db2.ts` (`title`, `slug`, `content`,
  `image`, `show_in_nav`, `sort_order`, `is_active`) plus generated migration
  `drizzle/db2/0001_orange_robbie_robertson.sql`.
- New dynamic route `src/app/pages/[slug]/page.tsx` with paragraph rendering,
  metadata and `notFound()` for unknown/hidden pages.
- Admin → **Pages** workspace (`PagesManager`): create/edit/publish/delete,
  “show in nav” checkbox, live preview of `/pages/<slug>` and a View link.
  Pages are never offered a category field, so they cannot appear under
  categories.
- Header/footer now build their menu from the live `/api/store` payload:
  active categories (any slug, sorted by admin order) followed by published
  pages whose `show_in_nav` is enabled.
- `src/app/category/[slug]/page.tsx` is a true dynamic route; legacy spellings
  are 308-redirected to the canonical URL, and `accounts`/`uc` keep their
  dedicated storefronts.
- `/pages` and `/category` are public in `src/lib/auth-config.ts`.

---

## 3. “Manage Product” did nothing; published products never reached the store

### Root causes found

1. **Dead action.** “Manage Products” only called `setSelectedSlug(...)` on a
   product panel far below the fold. Nothing visibly changed, so the button
   looked broken.
2. **Wrong/ignored publish field.** The database stores `is_active`, while the
   admin brief and some clients use `isPublished`. The original API only read
   `isActive`; a client sending `{ isPublished: true }` was silently ignored.
3. **Category resolution too strict.** Product create/update compared the
   submitted slug to `categories.slug` with exact equality. Legacy rows such as
   `Account`, `Supercar`, `Xsuite` or `SuperCars` did not match the normalised
   form slug, so publishing failed with “Selected category does not exist”.
4. **Hidden/limited flags survived edits.** Some edit paths resent
   `isActive: true` implicitly, and list filters used the raw slug.

### Fixes

- `src/components/admin-dashboard.tsx`
  - Categories workspace now has a keyed `ProductsManager` directly below the
    selected category; **Manage Products** selects the category and smooth-
    scrolls the panel into view.
  - Category and product forms include an explicit **Publish** checkbox;
    buttons read “PUBLISH PRODUCT” / “SAVE AS DRAFT” accordingly.
  - Every list row shows `LIVE` / `DRAFT` plus Edit, Publish/Unpublish,
    Delete and View on storefront actions.
  - Mutations call `invalidateStoreCatalog()` so the public hook refetches.
  - Product lists match categories through `canonicalCategorySlug`, so legacy
    spellings still display under the right collection.
- `src/app/api/admin/catalog/route.ts`
  - `publishFlag()` accepts `isPublished` or `isActive` (former wins), maps to
    `is_active`, and preserves the current value on partial PATCH.
  - POST/PATCH product resolve categories canonically and, for the four
    built-in collections, recreate a missing category row instead of failing.
  - Category rename/delete migrate/remove products by canonical slug.
  - New UC packages ensure the `uc` category exists.
- `src/app/api/store/route.ts` exposes both `isActive` and `isPublished` and
  canonicalises product `categorySlug`, so the public category page,
  `/accounts`, `/uc-purchase`, cart and checkout all match the same key.
- `src/components/special-category-page.tsx`, `accounts-page.tsx`,
  `uc-page.tsx`, `home-page.tsx`, `checkout-page.tsx` all consume the shared
  catalog hook and show a retry state on failure.

---

## Files added

| Path | Purpose |
|---|---|
| `src/lib/catalog.ts` | Slug/canonical/visibility/URL helpers shared by server and client |
| `src/lib/use-store-catalog.ts` | One cached `/api/store` client + `useStoreCatalog()` |
| `src/lib/store-queries.ts` | Server-side category/page lookups for metadata (never throw) |
| `src/app/pages/[slug]/page.tsx` | Dynamic CMS page renderer |
| `drizzle/db2/0001_orange_robbie_robertson.sql` | `pages` table migration |
| `sql/007_catalog_sync_repair.sql` | Idempotent production repair script |

## Files changed

`src/lib/store-tables.ts`, `src/lib/store-data.ts`, `src/lib/use-store-settings.ts`,
`src/lib/auth-config.ts`, `src/db/schemas/db2.ts`, `drizzle/db2/meta/_journal.json`,
`next.config.ts`, `src/app/api/store/route.ts`,
`src/app/api/admin/catalog/route.ts`, `src/app/category/[slug]/page.tsx`,
`src/components/site-chrome.tsx`, `src/components/home-page.tsx`,
`src/components/special-category-page.tsx`, `src/components/accounts-page.tsx`,
`src/components/uc-page.tsx`, `src/components/checkout-page.tsx`,
`src/components/cart-provider.tsx`, `src/components/admin-dashboard.tsx`,
`README.md`.

---

## Deploy checklist

1. Deploy the code.
2. Apply the repair to DB2 once (the app also runs it automatically on first
   request, but the script makes it explicit and auditable):

   ```bash
   psql "$DATABASE_URL_DB2" -f sql/007_catalog_sync_repair.sql
   ```

3. (Optional) confirm the result:

   ```sql
   SELECT 'categories' AS table_name, count(*) FILTER (WHERE is_active) AS visible, count(*) FROM categories
   UNION ALL SELECT 'products', count(*) FILTER (WHERE is_active), count(*) FROM products
   UNION ALL SELECT 'uc_packages', count(*) FILTER (WHERE is_active), count(*) FROM uc_packages
   UNION ALL SELECT 'pages', count(*) FILTER (WHERE is_active), count(*) FROM pages;
   ```

4. Open `/admin` → Catalog → Categories: create/edit a category or publish a
   product, then open its **View** link. Changes are live on the next request
   (`Cache-Control: no-store`).
5. Create a page under `/admin` → Pages; it appears at `/pages/<slug>` and in
   the header/footer when “Show in nav” is checked.

If the psql command is unavailable in the hosting environment, set the DB vars
locally and run the command from a machine that can reach Neon; the runtime
self-heal covers the common cases either way.
