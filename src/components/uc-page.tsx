"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FaBolt, FaWhatsapp } from "react-icons/fa";
import { FiArrowLeft, FiArrowRight, FiShield } from "react-icons/fi";
import { Category, defaultCategories, defaultUcPackages, formatINR, images, UcPackageItem } from "@/lib/store-data";
import { GridBackdrop, PageTitle, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { useStoreSettings } from "@/lib/use-store-settings";

export default function UcPage() {
  const router = useRouter();
  const [packs, setPacks] = useState<UcPackageItem[]>(defaultUcPackages);
  const [category, setCategory] = useState<Category>(
    defaultCategories.find((item) => item.slug === "uc") ?? defaultCategories[0],
  );
  const [unavailable, setUnavailable] = useState(false);
  const { whatsapp } = useStoreSettings();

  useEffect(() => {
    fetch(`/api/store?t=${Date.now()}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { ucPackages?: UcPackageItem[]; categories?: Category[] }) => {
        if (data.categories && !data.categories.some((item) => item.slug === "uc")) {
          setUnavailable(true);
          return;
        }
        if (data.ucPackages) setPacks(data.ucPackages);
        const ucCategory = data.categories?.find((item) => item.slug === "uc");
        if (ucCategory) setCategory(ucCategory);
      })
      .catch(() => undefined);
  }, []);

  return (
    <>
      <GridBackdrop />
      <SiteHeader />
      <main>
        <PageTitle
          eyebrow="BGMI UC PURCHASE"
          title={category.name}
          copy={category.description || "Select the UC volume you need and complete your request through official WhatsApp support."}
        />
        <section className="mx-auto max-w-7xl px-5 pb-20 lg:px-8">
          <div className="relative mb-8 overflow-hidden rounded-2xl border border-[#dbe2ec] bg-white shadow-sm">
            <img src={category.image || images.uc} alt={category.name} className="absolute inset-0 h-full w-full object-cover opacity-10" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#eef4fb] via-white to-transparent" />
            <div className="relative flex flex-col justify-between gap-6 p-7 sm:flex-row sm:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#e0eefb] px-3 py-1.5 text-[9px] font-bold tracking-[.14em] text-[#0f4c81]"><FaBolt /> INSTANT SUPPORT ROUTE</div>
                <h2 className="mt-4 text-2xl font-black tracking-[-.04em] text-[#0f172a]">{category.name} packages.</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[#64748b]">{category.description}</p>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-[#dbe2ec] bg-white px-4 py-3 text-xs font-bold text-[#334155]"><FiShield className="text-lg text-[#0f4c81]" /> Verified support path</div>
            </div>
          </div>

          {unavailable ? (
            <div className="rounded-2xl border border-dashed border-[#c7d2e0] bg-white/60 py-20 text-center">
              <p className="text-lg font-black text-[#0f172a]">UC Purchase is temporarily unavailable.</p>
              <p className="mt-2 text-sm text-[#64748b]">Please check back soon or contact the official support desk.</p>
              <Link href="/" className="btn-primary mt-6 inline-flex items-center gap-2"><FiArrowLeft /> BACK TO STORE</Link>
            </div>
          ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packs.map((pack, index) => (
              <motion.article
                key={pack.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="premium-card group p-6"
              >
                <div className="flex items-start justify-between">
                  <span className="rounded bg-[#e0eefb] px-2 py-1 text-[9px] font-bold tracking-[.12em] text-[#0f4c81]">{pack.bonusLabel ?? "UC BUNDLE"}</span>
                  <FaBolt className="text-2xl text-[#f4b400]" />
                </div>
                <div className="mt-6">
                  <p className="text-4xl font-black tracking-[-.06em] text-[#0f172a]">{pack.ucAmount.toLocaleString("en-IN")} <span className="text-lg text-[#0f4c81]">UC</span></p>
                  <p className="mt-1 text-xs font-bold text-[#64748b]">UNKNOWN CASH</p>
                </div>
                <div className="relative mt-7 flex items-center justify-between border-t border-[#e5e8ef] pt-5">
                  <span className="text-xl font-black text-[#0f172a]">{formatINR(pack.price)}</span>
                  <button
                    onClick={() => router.push(`/checkout?product=${encodeURIComponent(`${pack.ucAmount.toLocaleString("en-IN")} UC Package`)}&amount=${pack.price}&uid=1&category=uc`)}
                    className="btn-primary group !py-2.5 !px-4 text-[11px]"
                  >
                    CHECKOUT <FiArrowRight className="transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
          )}

          <div className="mt-14 grid gap-4 rounded-2xl border border-[#dbe2ec] bg-white p-6 md:grid-cols-4 shadow-sm">
            {[["01", "SELECT PACKAGE"], ["02", "TAP CHECKOUT"], ["03", "CONTACT WHATSAPP"], ["04", "COMPLETE PAYMENT"]].map(([no, text]) => (
              <div className="flex items-center gap-3" key={no}>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#e0eefb] text-xs font-bold text-[#0f4c81]">{no}</span>
                <span className="text-[10px] font-bold tracking-[.12em] text-[#64748b]">{text}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-xl border border-[#dbe2ec] bg-white p-5 text-center sm:flex-row sm:text-left shadow-sm">
            <p className="text-sm text-[#64748b]">Need help choosing a UC quantity? Speak to the official support desk.</p>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-outline !py-2.5 !px-4 text-xs"><FaWhatsapp className="text-sm" /> WHATSAPP SUPPORT</a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
