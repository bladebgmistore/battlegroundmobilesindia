-- ============================================================================
-- 007 — CATALOG SYNC REPAIR (DB2)
--
-- Run against DATABASE_URL_DB2 after any database import/update:
--
--   psql "$DATABASE_URL_DB2" -f sql/007_catalog_sync_repair.sql
--
-- It is fully idempotent. The application also runs the same repairs
-- automatically via `ensureStoreTables()` on first request, but running this
-- script once during a deploy makes the repair explicit and auditable.
--
-- Fixes:
--   1. Adds columns introduced after older tables were created.
--   2. Backfills NULL is_active flags (the reason categories/products
--      "vanished" from public queries while remaining visible in admin).
--   3. Honours legacy is_published / status columns when present.
--   4. Creates the CMS `pages` table (pages are not categories).
--   5. Migrates legacy accounts + special_products rows into products,
--      including rows tagged `Supercar` / `Xsuite`.
--   6. Normalises known legacy product category keys and creates a category
--      row for every remaining orphaned product slug.
-- ============================================================================

BEGIN;

-- ── 1. Categories ───────────────────────────────────────────────────────────
ALTER TABLE categories ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 100;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE categories ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE categories SET sort_order = 100 WHERE sort_order IS NULL;
UPDATE categories
   SET name = initcap(replace(slug, '-', ' '))
 WHERE name IS NULL OR btrim(name) = '';

-- ── 2. Products ─────────────────────────────────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS badge varchar(48);
ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE products SET sort_order = 0 WHERE sort_order IS NULL;
UPDATE products SET features = '[]'::jsonb WHERE features IS NULL;

-- ── 3. Legacy inventory + UC + coupons ──────────────────────────────────────
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS badge varchar(48);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE special_products ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE special_products ADD COLUMN IF NOT EXISTS badge varchar(48);
ALTER TABLE special_products ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE special_products ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE special_products ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE special_products ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE uc_packages ADD COLUMN IF NOT EXISTS bonus_label varchar(80);
ALTER TABLE uc_packages ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE uc_packages ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

UPDATE accounts SET features = '[]'::jsonb WHERE features IS NULL;
UPDATE special_products SET features = '[]'::jsonb WHERE features IS NULL;

-- ── 4. CMS pages ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(180) NOT NULL,
  slug varchar(120) NOT NULL UNIQUE,
  content text NOT NULL DEFAULT '',
  image text,
  show_in_nav boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pages_active_order_idx ON pages (is_active, sort_order);

-- ── 5. Honour legacy publish/status columns (only where is_active is NULL) ──
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'is_published'
  ) THEN
    EXECUTE 'UPDATE products SET is_active = is_published WHERE is_active IS NULL AND is_published IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'status'
  ) THEN
    EXECUTE 'UPDATE products SET is_active = (lower(coalesce(status, '''')) IN (''published'', ''active'', ''live'')) WHERE is_active IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'is_published'
  ) THEN
    EXECUTE 'UPDATE categories SET is_active = is_published WHERE is_active IS NULL AND is_published IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'status'
  ) THEN
    EXECUTE 'UPDATE categories SET is_active = (lower(coalesce(status, '''')) IN (''published'', ''active'', ''live'')) WHERE is_active IS NULL';
  END IF;
END $$;

-- If an old deployment used `is_published` as the source of truth even for
-- rows whose `is_active` was already filled in, review the data and run this
-- manually (it is intentionally commented out — it would overwrite deliberate
-- admin hides):
-- UPDATE products   SET is_active = is_published WHERE is_published IS NOT NULL;
-- UPDATE categories SET is_active = is_published WHERE is_published IS NOT NULL;

-- Remaining NULL flags (no legacy publish/status value) default to visible.
UPDATE categories SET is_active = true WHERE is_active IS NULL;
UPDATE products SET is_active = true WHERE is_active IS NULL;
UPDATE accounts SET is_active = true WHERE is_active IS NULL;
UPDATE special_products SET is_active = true WHERE is_active IS NULL;
UPDATE uc_packages SET is_active = true WHERE is_active IS NULL;
UPDATE coupons SET is_active = true WHERE is_active IS NULL;

-- ── 6. Legacy inventory → unified products table ────────────────────────────
INSERT INTO categories (name, slug, description, sort_order, is_active)
SELECT 'Premium Accounts', 'accounts', 'Find the high-tier BGMI account that matches your play style.', 10, true
WHERE EXISTS (SELECT 1 FROM accounts)
  AND NOT EXISTS (
    SELECT 1 FROM categories
    WHERE regexp_replace(lower(slug), '[^a-z]', '', 'g') IN ('account', 'accounts', 'premiumaccount', 'premiumaccounts')
  );

-- UC packages are hidden by /api/store when their category row is missing.
INSERT INTO categories (name, slug, description, sort_order, is_active)
SELECT 'UC Purchase', 'uc', 'High-value UC packages for your next BGMI upgrade.', 20, true
WHERE EXISTS (SELECT 1 FROM uc_packages)
  AND NOT EXISTS (
    SELECT 1 FROM categories
    WHERE regexp_replace(lower(slug), '[^a-z]', '', 'g') IN ('uc', 'ucs', 'ucpackage', 'ucpackages', 'ucpurchase')
  );

INSERT INTO categories (name, slug, description, sort_order, is_active)
SELECT 'Super Cars', 'super-cars', 'Premium limited-edition supercars with specialised card packs.', 30, true
WHERE EXISTS (SELECT 1 FROM special_products WHERE regexp_replace(lower(category), '[^a-z]', '', 'g') IN ('car', 'cars', 'supercar', 'supercars'))
  AND NOT EXISTS (
    SELECT 1 FROM categories
    WHERE regexp_replace(lower(slug), '[^a-z]', '', 'g') IN ('car', 'cars', 'supercar', 'supercars')
  );

INSERT INTO categories (name, slug, description, sort_order, is_active)
SELECT 'X-Suits', 'x-suits', 'Legendary BGMI X-Suits with secure guided delivery.', 40, true
WHERE EXISTS (SELECT 1 FROM special_products WHERE regexp_replace(lower(category), '[^a-z]', '', 'g') IN ('xsuit', 'xsuits', 'xsuite'))
  AND NOT EXISTS (
    SELECT 1 FROM categories
    WHERE regexp_replace(lower(slug), '[^a-z]', '', 'g') IN ('xsuit', 'xsuits', 'xsuite')
  );

INSERT INTO products (category_slug, title, price, image, features, badge, sort_order, is_active)
SELECT 'accounts', a.title, a.price, a.image, coalesce(a.features, '[]'::jsonb), a.badge,
       (row_number() OVER (ORDER BY a.created_at))::int - 1, coalesce(a.is_active, true)
FROM accounts a
WHERE coalesce(a.is_active, true) = true
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.category_slug = 'accounts' AND lower(p.title) = lower(a.title)
  );

INSERT INTO products (category_slug, title, price, image, features, badge, sort_order, is_active)
SELECT
  CASE WHEN regexp_replace(lower(s.category), '[^a-z]', '', 'g') IN ('xsuit', 'xsuits', 'xsuite') THEN 'x-suits' ELSE 'super-cars' END,
  s.title, s.price, s.image, coalesce(s.features, '[]'::jsonb), s.badge,
  coalesce(s.sort_order, 0), coalesce(s.is_active, true)
FROM special_products s
WHERE coalesce(s.is_active, true) = true
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.category_slug = CASE WHEN regexp_replace(lower(s.category), '[^a-z]', '', 'g') IN ('xsuit', 'xsuits', 'xsuite') THEN 'x-suits' ELSE 'super-cars' END
      AND lower(p.title) = lower(s.title)
  );

-- ── 7. Canonical product category keys (known families only) ────────────────
UPDATE products SET category_slug = 'accounts'
 WHERE category_slug <> 'accounts'
   AND regexp_replace(lower(category_slug), '[^a-z]', '', 'g') IN ('account', 'accounts', 'premiumaccount', 'premiumaccounts');
UPDATE products SET category_slug = 'uc'
 WHERE category_slug <> 'uc'
   AND regexp_replace(lower(category_slug), '[^a-z]', '', 'g') IN ('uc', 'ucs', 'ucpackage', 'ucpackages', 'ucpurchase');
UPDATE products SET category_slug = 'super-cars'
 WHERE category_slug <> 'super-cars'
   AND regexp_replace(lower(category_slug), '[^a-z]', '', 'g') IN ('car', 'cars', 'supercar', 'supercars');
UPDATE products SET category_slug = 'x-suits'
 WHERE category_slug <> 'x-suits'
   AND regexp_replace(lower(category_slug), '[^a-z]', '', 'g') IN ('xsuit', 'xsuits', 'xsuite');

-- ── 8. Orphan repair — every product slug must exist as a category ──────────
INSERT INTO categories (name, slug, description, sort_order, is_active)
SELECT initcap(replace(p.category_slug, '-', ' ')), p.category_slug,
       'Products published from the admin catalog.', 100, true
FROM (SELECT DISTINCT category_slug FROM products WHERE category_slug IS NOT NULL AND btrim(category_slug) <> '') p
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.slug = p.category_slug
    OR (p.category_slug = 'accounts' AND regexp_replace(lower(c.slug), '[^a-z]', '', 'g') IN ('account', 'accounts', 'premiumaccount', 'premiumaccounts'))
    OR (p.category_slug = 'uc' AND regexp_replace(lower(c.slug), '[^a-z]', '', 'g') IN ('uc', 'ucs', 'ucpackage', 'ucpackages', 'ucpurchase'))
    OR (p.category_slug = 'super-cars' AND regexp_replace(lower(c.slug), '[^a-z]', '', 'g') IN ('car', 'cars', 'supercar', 'supercars'))
    OR (p.category_slug = 'x-suits' AND regexp_replace(lower(c.slug), '[^a-z]', '', 'g') IN ('xsuit', 'xsuits', 'xsuite'))
);

-- ── 9. Performance indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS products_category_idx ON products (category_slug, sort_order);
CREATE INDEX IF NOT EXISTS products_active_idx ON products (is_active);
CREATE INDEX IF NOT EXISTS categories_active_idx ON categories (is_active, sort_order);

COMMIT;

-- ── 10. Verification (run manually after COMMIT) ────────────────────────────
-- SELECT 'categories' AS table_name, count(*) FILTER (WHERE is_active) AS visible, count(*) AS total FROM categories
-- UNION ALL
-- SELECT 'products', count(*) FILTER (WHERE is_active), count(*) FROM products
-- UNION ALL
-- SELECT 'uc_packages', count(*) FILTER (WHERE is_active), count(*) FROM uc_packages
-- UNION ALL
-- SELECT 'pages', count(*) FILTER (WHERE is_active), count(*) FROM pages;
