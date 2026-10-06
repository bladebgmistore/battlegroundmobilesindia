"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { FiArrowLeft, FiArrowRight, FiCheck } from "react-icons/fi";
import { Product } from "@/lib/store-data";
import { PriceTag } from "@/components/price-tag";
import { GridBackdrop, PageTitle, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { useStoreSettings } from "@/lib/use-store-settings";

type Props = {
  category: string;
  eyebrow: string;
  title: string;
  copy: string;
};

export default function SpecialCategoryPage({ category, eyebrow, title, copy }: Props) {
  const router = useRouter();
  const { whatsapp } = useStoreSettings();
  const [items, setItems] = useState<Product[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    setCatalogLoaded(false);
    fetch(`/api/store?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json().catch(() => null))
      .then((data: { products?: Product[]; categories?: { slug: string }[] } | null) => {
        const categories = Array.isArray(data?.categories) ? data.categories : [];
        const activeSlugs = new Set(categories.map((c) => c.slug));
        // If the category was disabled in admin, don't surface any Checkout buttons.
        if (categories.length && !activeSlugs.has(category)) {
          setItems([]);
          setUnavailable(true);
          return;
        }
        setUnavailable(false);
        setItems(Array.isArray(data?.products) ? data.products.filter((p) => p.categorySlug === category) : []);
      })
      .catch(() => {
        setItems([]);
      })
      .finally(() => setCatalogLoaded(true));
  }, [category]);

  const requiresUid = category === "super-cars" || category === "x-suits";
  const buy = (name: string, price: number) =>
    router.push(`/checkout?product=${encodeURIComponent(name)}&amount=${price}${requiresUid ? "&uid=1" : ""}&category=${encodeURIComponent(category)}`);

  return (
    <>
      <GridBackdrop />
      <SiteHeader />
      <main>
        <div className="mx-auto max-w-7xl px-5 pt-10 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[10px] font-black tracking-[.12em] text-[#64748b] hover:text-[#0f172a]"
          >
            <FiArrowLeft /> BACK TO STORE
          </Link>
        </div>
        <PageTitle eyebrow={eyebrow} title={title} copy={copy} />

        <section className="mx-auto max-w-7xl px-5 pb-20 lg:px-8">
          {!catalogLoaded ? (
            <div className="rounded-2xl border border-dashed border-[#c7d2e0] bg-white/60 py-20 text-center" data-aos="fade-up">
              <p className="text-lg font-black text-[#0f172a]">Loading live products…</p>
              <p className="mt-2 text-sm text-[#64748b]">Only database products are shown here.</p>
            </div>
          ) : unavailable ? (
            <div className="rounded-2xl border border-dashed border-[#c7d2e0] bg-white/60 py-20 text-center">
              <p className="text-lg font-black text-[#0f172a]">This category is temporarily unavailable.</p>
              <p className="mt-2 text-sm text-[#64748b]">Please check back soon or contact the official support desk.</p>
              <Link href="/" className="btn-primary mt-6 inline-flex items-center gap-2"><FiArrowLeft /> BACK TO STORE</Link>
            </div>
          ) : items.length ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
              {items.map((item, index) => (
                <article
                  key={item.id}
                  data-aos={index % 2 === 0 ? "fade-up" : "zoom-in"}
                  data-aos-delay={Math.min(index * 80, 360)}
                  className="premium-card gaming-card group overflow-hidden rounded-2xl border border-[#e5e8ef] bg-white"
                >
                  <div className="relative aspect-[1.25] overflow-hidden bg-[#eef1f6]">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                    {item.badge && (
                      <span className="absolute left-4 top-4 rounded-md bg-[#0f4c81] px-2.5 py-1 text-[9px] font-bold tracking-[.14em] text-white">
                        {item.badge}
                      </span>
                    )}
                    <span className="absolute bottom-4 right-4 rounded-lg bg-white/92 px-3 py-1.5 shadow-sm backdrop-blur">
                      <PriceTag price={item.price} priceClass="text-sm font-black text-[#0f172a]" />
                    </span>
                  </div>
                  <div className="p-5">
                    <h2 className="text-lg font-black tracking-[.02em] text-[#0f172a]">{item.title}</h2>
                    <div className="mt-4 space-y-2">
                      {item.features.map((feature) => (
                        <div
                          key={feature}
                          className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-[#334155]"
                        >
                          <FiCheck className="shrink-0 text-[#0e9f6e]" />
                          {feature}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => buy(item.title, item.price)}
                      className="btn-primary group mt-5 w-full !py-3.5 text-xs tracking-[.1em]"
                    >
                      CHECKOUT <FiArrowRight className="text-base transition-transform group-hover:translate-x-1" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#c7d2e0] bg-white/60 py-20 text-center">
              <p className="text-lg font-black text-[#0f172a]">No packages available right now.</p>
              <p className="mt-2 text-sm text-[#64748b]">Please check back soon or contact support.</p>
            </div>
          )}

          <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-xl border border-[#e5e8ef] bg-[#f8fafc] p-5 text-center sm:flex-row sm:text-left">
            <p className="text-sm text-[#64748b]">
              Need help choosing a package? Talk to our official support desk.
            </p>
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline !px-4 !py-2.5 text-[10px] tracking-[.1em]"
            >
              <FaWhatsapp className="text-sm" /> WHATSAPP SUPPORT
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
