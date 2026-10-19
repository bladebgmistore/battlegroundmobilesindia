import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import SpecialCategoryPage from "@/components/special-category-page";
import { CATEGORY_ROUTE_OVERRIDES, canonicalCategorySlug } from "@/lib/catalog";
import { getStoreCategory } from "@/lib/store-queries";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

/**
 * Dynamic category route.
 *
 * Any category created in the admin panel is reachable at
 * `/category/<slug>` with no code change. Legacy/friendly slugs are
 * permanently redirected to the canonical URL so links shared before a rename
 * keep working and search engines only index one address per category.
 */
export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const canonical = canonicalCategorySlug(slug);

  // `accounts` and `uc` have dedicated storefronts.
  const dedicatedRoute = CATEGORY_ROUTE_OVERRIDES[canonical];
  if (dedicatedRoute) permanentRedirect(dedicatedRoute);

  if (canonical !== slug) permanentRedirect(`/category/${canonical}`);

  const readable = canonical.toUpperCase().replace(/-/g, " ");

  return (
    <SpecialCategoryPage
      category={canonical}
      eyebrow={readable}
      title={`${readable} packages.`}
      copy={`Choose a package from the ${readable} collection. Completed with safe guided delivery and official support.`}
    />
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const canonical = canonicalCategorySlug(slug);
  const category = await getStoreCategory(canonical);

  if (!category) {
    return {
      title: "Premium Store Category | Battleground Mobile India Store",
      description: "Browse premium BGMI category products with guided handovers.",
    };
  }

  return {
    title: `${category.name} | Battleground Mobile India Store`,
    description:
      category.description ||
      `Browse ${category.name} listings with live availability, verified details and guided delivery.`,
    alternates: { canonical: `/category/${category.slug}` },
    openGraph: {
      title: `${category.name} | Battleground Mobile India Store`,
      description: category.description || `Browse ${category.name} listings.`,
      images: category.image ? [category.image] : undefined,
    },
  };
}
