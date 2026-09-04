"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import { FaBolt, FaStar, FaWhatsapp } from "react-icons/fa";
import { FiArrowRight, FiCheck, FiChevronDown, FiChevronRight, FiLock, FiShield, FiTrendingUp, FiUsers } from "react-icons/fi";
import { defaultCategories, defaultProducts, defaultUcPackages, faqs, formatINR, images, Product, Category, reviews, UcPackageItem } from "@/lib/store-data";
import { GridBackdrop, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { useStoreSettings } from "@/lib/use-store-settings";

const fadeUp = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } };

export function BuyButton({ item, requiresUid = false, category }: { item: { title: string; price: number }; requiresUid?: boolean; category?: string }) {
  const router = useRouter();
  const buy = () => router.push(`/checkout?product=${encodeURIComponent(item.title)}&amount=${item.price}${requiresUid ? "&uid=1" : ""}${category ? `&category=${encodeURIComponent(category)}` : ""}`);
  return (
    <button onClick={buy} className="btn-primary group w-full">
      BUY NOW <FiArrowRight className="text-base transition-transform group-hover:translate-x-1" />
    </button>
  );
}

export function UcBuyButton({ item }: { item: { title: string; price: number } }) {
  const router = useRouter();
  const buy = () => router.push(`/checkout?product=${encodeURIComponent(item.title)}&amount=${item.price}&uid=1&category=${encodeURIComponent("uc")}`);
  return (
    <button onClick={buy} className="btn-primary group !py-2 !px-3.5 !text-[10px] uppercase font-bold tracking-wide">
      BUY NOW <FiArrowRight className="text-[10px] transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function CategoryShelf({ category, products }: { category: Category; products: Product[] }) {
  return (
    <section id={category.slug} className="border-b border-[#eef1f6] py-20 last:border-b-0">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-[#dbe2ec] bg-white">
          <div className="absolute inset-0 bg-gradient-to-r from-[#eef4fb] via-white to-transparent" />
          <div className="relative px-6 py-9 sm:px-9">
            <p className="text-[10px] font-bold tracking-[.2em] text-[#0f4c81]">{category.name.toUpperCase()} STORE</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-[-.045em] text-[#0f172a] sm:text-4xl">{category.name}</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#64748b]">{category.description}</p>
            {category.slug === "accounts" && (
              <Link href="/accounts" className="mt-5 inline-flex items-center gap-2 text-xs font-bold tracking-[.1em] text-[#0f4c81]">
                VIEW ALL ACCOUNTS <FiArrowRight />
              </Link>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {products.length ? products.map((item, index) => (
            <motion.article
              key={item.id}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="premium-card group overflow-hidden rounded-2xl"
            >
              <div className="relative aspect-[1.22] overflow-hidden bg-[#eef1f6]">
                <img src={item.image} alt={item.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                {item.badge && <span className="absolute left-4 top-4 rounded-md bg-[#0f4c81] px-2.5 py-1 text-[9px] font-bold tracking-[.14em] text-white">{item.badge}</span>}
                <span className="absolute bottom-4 right-4 rounded-lg bg-white px-3 py-1.5 text-base font-black text-[#0f172a] shadow">{formatINR(item.price)}</span>
              </div>
              <div className="p-5">
                <h3 className="min-h-[40px] text-[15px] font-black leading-5 tracking-[.02em] text-[#0f172a]">{item.title}</h3>
                <div className="mt-4 space-y-2">
                  {item.features.slice(0, 5).map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-[#64748b]">
                      <FiCheck className="shrink-0 text-[#0e9f6e]" />{feature}
                    </div>
                  ))}
                </div>
                <div className="mt-5"><BuyButton item={item} requiresUid={category.slug === "super-cars" || category.slug === "x-suits"} category={category.slug} /></div>
              </div>
            </motion.article>
          )) : (
            <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-[#dbe2ec] bg-white/60 py-12 text-center">
              <p className="text-sm font-bold text-[#0f172a]">Deals coming soon.</p>
              <p className="mt-2 text-xs text-[#64748b]">This category is live and ready for new products from the admin panel.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [productList, setProductList] = useState<Product[]>(defaultProducts);
  const [ucList, setUcList] = useState<UcPackageItem[]>(defaultUcPackages);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const { whatsapp: whatsappUrl, settings } = useStoreSettings();

  useEffect(() => {
    fetch(`/api/store?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { categories?: Category[]; products?: Product[]; ucPackages?: UcPackageItem[] } | null) => {
        if (data?.categories) setCategories(data.categories);
        if (data?.products) setProductList(data.products);
        if (data?.ucPackages) setUcList(data.ucPackages);
      })
      .catch(() => undefined);

    fetch(`/api/feedbacks?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.feedbacks) setFeedbacks(d.feedbacks); })
      .catch(() => undefined);
  }, []);

  const accountCategory = categories.find((category) => category.slug === "accounts");
  const ucCategory = categories.find((category) => category.slug === "uc");
  const otherCategories = categories.filter((category) => category.slug !== "accounts" && category.slug !== "uc");

  return (
    <>
      <GridBackdrop />
      <SiteHeader />
      <main>
        {/* Hero Section - Light Theme */}
        <section className="relative overflow-hidden bg-white border-b border-gray-100">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-16 sm:pt-24 lg:grid-cols-[1.1fr_.9fr] lg:px-8 lg:pb-24">
            <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: .12 } } }}>
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-black tracking-[.15em] text-blue-600">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> PREMIUM BGMI MARKETPLACE
              </motion.div>
              <motion.h1 variants={fadeUp} className="mt-6 max-w-2xl text-[clamp(2.3rem,6vw,4.8rem)] font-black leading-[1.05] tracking-[-.05em] text-gray-900 uppercase">
                {settings.homepage_headline || "PLAY WITHOUT THE GRIND."}
              </motion.h1>
              <motion.p variants={fadeUp} className="mt-6 max-w-xl text-base leading-7 text-gray-600 sm:text-lg">
                Discover premium BGMI accounts and UC packages with clear details, secure-guidance handovers and fast support from our verified team.
              </motion.p>
              <motion.div variants={fadeUp} className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href="/accounts" className="btn-primary group">
                  EXPLORE ACCOUNTS <FiArrowRight className="text-base transition-transform group-hover:translate-x-1" />
                </Link>
                <Link href="/uc-purchase" className="btn-outline">
                  BUY UC <FaBolt className="text-[#f4b400]" />
                </Link>
                <Link href="#super-cars" className="btn-outline">
                  SUPER-CAR <FiArrowRight className="text-base" />
                </Link>
                <Link href="#x-suits" className="btn-outline">
                  X-SUIT <FiArrowRight className="text-base" />
                </Link>
              </motion.div>
              <motion.div variants={fadeUp} className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-bold text-gray-500">
                <span className="flex items-center gap-2"><FiShield className="text-blue-500" /> GUIDED HANDOVERS</span>
                <span className="flex items-center gap-2"><FiLock className="text-blue-500" /> SECURE SUPPORT</span>
                <span className="flex items-center gap-2"><FiUsers className="text-blue-500" /> COMMUNITY TRUSTED</span>
              </motion.div>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.94, x: 20 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ duration: 0.75, delay: 0.15 }} className="relative mx-auto w-full max-w-[520px]">
              <div className="relative overflow-hidden rounded-[1.75rem] border border-gray-200 bg-white p-2 shadow-xl">
                <div className="relative aspect-[.96] overflow-hidden rounded-[1.3rem]">
                  <img src={settings.featured_drop_image || categories[0]?.image || images.uc} alt="Premium BGMI collection" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-white/60 via-white/20 to-transparent" />
                  <div className="absolute left-5 top-5 rounded-lg border border-blue-200 bg-white/90 px-3 py-2 backdrop-blur">
                    <p className="text-[9px] font-black tracking-[.14em] text-blue-600">{settings.featured_drop_label || "FEATURED DROP"}</p>
                    <p className="mt-1 text-xl font-black text-gray-900">{settings.featured_drop_title || "ELITE INVENTORY"}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Stats segment */}
        <section className="border-y border-[#eef1f6] bg-white">
          <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-[#eef1f6] px-5 sm:grid-cols-4 sm:divide-y-0 lg:px-8">
            {[["12K+", "TRUSTED CUSTOMERS"], ["8.6K+", "SUCCESSFUL ORDERS"], ["4.9/5", "HAPPY PLAYERS"], ["24/7", "SECURE SUPPORT"]].map(([number, label]) => (
              <div key={label} className="p-6 text-center sm:p-8">
                <p className="text-2xl font-black tracking-[-.05em] text-[#0f4c81] sm:text-3xl">{number}</p>
                <p className="mt-1 text-[9px] font-bold tracking-[.15em] text-[#64748b]">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Accounts first */}
        {accountCategory && (
          <CategoryShelf
            category={accountCategory}
            products={productList.filter((product) => product.categorySlug === "accounts")}
          />
        )}

        {/* UC Store Section */}
        <section id="uc" className="relative border-y border-[#eef1f6] bg-white/70 py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
            <div className="relative overflow-hidden rounded-2xl border border-[#dbe2ec] min-h-[340px]">
              <img src={ucCategory?.image || images.uc} alt={ucCategory?.name || "BGMI UC packages"} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-white/70 via-white/30 to-transparent" />
              <div className="relative flex h-full min-h-[340px] flex-col justify-end p-7">
                <p className="text-[10px] font-bold tracking-[.18em] text-[#0f4c81]">{(ucCategory?.name || "UC").toUpperCase()} STORE</p>
                <h2 className="mt-3 text-4xl font-black leading-none tracking-[-.05em] text-[#0f172a]">{ucCategory?.name || "UC PURCHASE"}</h2>
                <p className="mt-4 max-w-sm text-sm leading-6 text-[#64748b]">{ucCategory?.description || "Choose a high-value UC bundle and let our team guide you through the completion process."}</p>
                <Link href="/uc-purchase" className="mt-6 inline-flex w-fit items-center gap-2 text-xs font-bold tracking-[.1em] text-[#0f4c81]">
                  EXPLORE UC <FiArrowRight />
                </Link>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {ucList.slice(0, 6).map((pack, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  key={pack.id}
                  className="premium-card group p-5"
                >
                  <div className="flex items-start justify-between">
                    <span className="rounded bg-[#e0eefb] px-2 py-1 text-[8px] font-bold tracking-[.12em] text-[#0f4c81]">{pack.bonusLabel ?? "UC BUNDLE"}</span>
                    <FaBolt className="text-[#f4b400]" />
                  </div>
                  <p className="mt-5 text-2xl font-black tracking-[-.05em] text-[#0f172a]">{pack.ucAmount.toLocaleString("en-IN")} <span className="text-sm text-[#0f4c81]">UC</span></p>
                  <div className="mt-4 flex items-center justify-between border-t border-[#e5e8ef] pt-3.5">
                    <span className="text-base font-extrabold text-[#0f4c81]">{formatINR(pack.price)}</span>
                    <UcBuyButton item={{ title: `${pack.ucAmount.toLocaleString("en-IN")} UC Package`, price: pack.price }} />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Super Cars, X-Suits, then any custom admin-created categories */}
        {otherCategories.map((category) => (
          <CategoryShelf
            key={category.id}
            category={category}
            products={productList.filter((product) => product.categorySlug === category.slug)}
          />
        ))}

        {/* Customer Reviews - Dynamic from database */}
        <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <p className="text-[11px] font-bold tracking-[.22em] text-[#0f4c81]">PLAYER FEEDBACK</p>
              <h2 className="mt-3 text-4xl font-black tracking-[-.05em] text-[#0f172a]">Earned in the<br />community.</h2>
              <p className="mt-5 max-w-sm text-sm leading-7 text-[#64748b]">Trusted by thousands of community members for a straightforward buying journey and responsive communication.</p>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 text-xs font-bold tracking-[.1em] text-[#0f4c81]">
                <FaWhatsapp className="text-base" /> SPEAK WITH SUPPORT
              </a>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {(feedbacks.length ? feedbacks : reviews).map((review: any, idx: number) => (
                <article key={review.id || review.name || idx} className="premium-card p-5">
                  <div className="flex gap-1 text-[#f4b400]">
                    {Array.from({ length: review.rating || 5 }).map((_, i) => <FaStar key={i} className="text-xs" />)}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#334155]">“{review.review || review.body}”</p>
                  <div className="mt-6 border-t border-[#e5e8ef] pt-4">
                    <p className="text-xs font-bold text-[#0f172a]">{review.name}</p>
                    <p className="mt-1 text-[9px] font-bold tracking-[.12em] text-[#0e9f6e]">VERIFIED BUYER</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        {/* FAQ Section */}
        <section className="mx-auto max-w-4xl px-5 pb-8 pt-4">
          <div className="text-center">
            <p className="text-[11px] font-bold tracking-[.22em] text-[#0f4c81]">NEED TO KNOW</p>
            <h2 className="mt-3 text-4xl font-black tracking-[-.05em] text-[#0f172a]">Questions, answered.</h2>
          </div>
          <div className="mt-10 divide-y divide-[#e5e8ef] rounded-2xl border border-[#dbe2ec] bg-white px-5 sm:px-7">
            {faqs.map((faq, index) => (
              <div key={faq.question}>
                <button onClick={() => setActiveFaq(activeFaq === index ? null : index)} className="flex w-full items-center justify-between gap-6 py-5 text-left">
                  <span className="text-sm font-semibold text-[#0f172a]">{faq.question}</span>
                  <FiChevronDown className={`shrink-0 text-lg text-[#0f4c81] transition ${activeFaq === index ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {activeFaq === index && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <p className="max-w-2xl pb-5 text-sm leading-6 text-[#64748b]">{faq.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="premium-card px-7 py-10 sm:px-12 sm:py-14">
            <div className="flex flex-col items-start justify-between gap-7 md:flex-row md:items-center">
              <div>
                <p className="text-[10px] font-bold tracking-[.17em] text-[#0f4c81]">READY WHEN YOU ARE</p>
                <h2 className="mt-3 text-3xl font-black tracking-[-.045em] text-[#0f172a]">Have a product in mind?</h2>
                <p className="mt-2 text-sm text-[#64748b]">Select it now and we will route you to our official support channel.</p>
              </div>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn-whatsapp shrink-0"><FaWhatsapp className="text-base" /> CHAT WITH ADMIN</a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
