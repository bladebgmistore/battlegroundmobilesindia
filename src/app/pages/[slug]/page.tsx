import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { GridBackdrop, PageTitle, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { normalizeSlug } from "@/lib/catalog";
import { getStorePage } from "@/lib/store-queries";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

/**
 * Clean dynamic route for every CMS page created in the admin panel.
 *
 * Pages are stored in their own `pages` table and never in `categories`, so a
 * new page cannot accidentally appear as a store category or a product
 * filter — it simply gets a real, shareable URL: `/pages/<slug>`.
 */
export default async function DynamicPage({ params }: PageProps) {
  const { slug } = await params;
  const requested = normalizeSlug(slug);
  // Keep one indexable address per page (`/pages/About Us` → `/pages/about-us`).
  if (requested !== slug) permanentRedirect(`/pages/${requested}`);

  const page = await getStorePage(requested);
  if (!page) notFound();

  const paragraphs = page.content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <>
      <GridBackdrop />
      <SiteHeader />
      <main>
        <PageTitle
          eyebrow="STORE INFORMATION"
          title={page.title}
          copy={paragraphs[0]?.slice(0, 220) || "Information published from the admin control centre."}
        />
        <section className="mx-auto max-w-4xl px-5 pb-20 lg:px-8">
          {page.image && (
            <div className="mb-8 overflow-hidden rounded-2xl border border-[#dbe2ec] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={page.image} alt={page.title} className="max-h-[420px] w-full object-cover" />
            </div>
          )}
          <article className="rounded-2xl border border-[#dbe2ec] bg-white p-6 sm:p-9">
            <div className="space-y-5">
              {paragraphs.length ? (
                paragraphs.map((paragraph, index) => (
                  <p key={`${page.id}-${index}`} className="whitespace-pre-line text-sm leading-7 text-[#475569]">
                    {paragraph}
                  </p>
                ))
              ) : (
                <p className="text-sm text-[#64748b]">This page has no content yet.</p>
              )}
            </div>
          </article>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getStorePage(normalizeSlug(slug));

  if (!page) {
    return { title: "Page not found | Battleground Mobile India Store", robots: { index: false, follow: false } };
  }

  return {
    title: `${page.title} | Battleground Mobile India Store`,
    description: page.content.replace(/\s+/g, " ").trim().slice(0, 160) || `${page.title} — store information.`,
    alternates: { canonical: `/pages/${page.slug}` },
  };
}
