import SpecialCategoryPage from "@/components/special-category-page";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Premium Store Category | Battleground Mobile India Store",
  description: "Browse premium BGMI category products with guided handovers.",
};

type PageProps = { params: Promise<{ slug: string }> };

const aliases: Record<string, string> = {
  "super-car": "super-cars",
  "x-suit": "x-suits",
};

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const categorySlug = aliases[slug] ?? slug;
  const readable = categorySlug.toUpperCase().replace(/-/g, " ");

  return (
    <SpecialCategoryPage
      category={categorySlug}
      eyebrow={readable}
      title={`${readable} packages.`}
      copy={`Choose a package from the ${readable} collection. Completed with safe guided delivery and official support.`}
    />
  );
}
