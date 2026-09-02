"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { FiCheck, FiCopy, FiSearch, FiSliders, FiX, FiZoomIn } from "react-icons/fi";
import { defaultAccounts, formatINR, Product } from "@/lib/store-data";
import { GridBackdrop, PageTitle, SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function AccountsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState(100000);
  const [selected, setSelected] = useState<Product | null>(null);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setWishlist(JSON.parse(localStorage.getItem("bgmi-wishlist") ?? "[]"));
    fetch("/api/store")
      .then((r) => r.json())
      .then((d: { products?: Product[] }) => {
        if (d?.products) {
          setItems(d.products.filter((p) => p.categorySlug === "accounts" && p.isActive !== false));
        }
      })
      .catch(() => {
        setItems(
          defaultAccounts.map((a, i) => ({
            id: a.id,
            categorySlug: "accounts",
            title: a.title,
            price: a.price,
            image: a.image,
            features: a.features,
            badge: a.badge ?? null,
            sortOrder: i,
            isActive: true,
          }))
        );
      });
  }, []);

  const shown = useMemo(() => {
    return items.filter((item) => {
      const matchQuery = item.title.toLowerCase().includes(query.toLowerCase());
      const matchPrice = item.price <= maxPrice;
      return matchQuery && matchPrice;
    });
  }, [items, query, maxPrice]);

  const toggleWishlist = (id: string) => {
    const next = wishlist.includes(id) ? wishlist.filter((x) => x !== id) : [...wishlist, id];
    setWishlist(next);
    localStorage.setItem("bgmi-wishlist", JSON.stringify(next));
  };

  // Accounts never require Player UID; only UC, Super Cars and X-Suits do.
  const checkout = (item: Product) =>
    router.push(`/checkout?product=${encodeURIComponent(item.title)}&amount=${item.price}`);

  const copy = async () => {
    await navigator.clipboard.writeText(location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <>
      <GridBackdrop />
      <SiteHeader />
      <main>
        <PageTitle
          eyebrow="PREMIUM ACCOUNT STORE"
          title="Find the account that matches your game."
          copy="Browse detailed collections at your own pace. Every listing is presented with its key inventory so you can make an informed selection before speaking with support."
        />
        <section className="mx-auto max-w-7xl px-5 pb-20 lg:px-8">
          <div className="flex flex-col gap-4 rounded-2xl border border-[#dbe2ec] bg-white p-4 md:flex-row md:items-center shadow-sm">
            <div className="relative flex-1">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748b]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search XSUIT, mythic, supercar..."
                className="h-12 w-full rounded-xl border border-[#dbe2ec] bg-white pl-11 pr-4 text-sm text-[#0f172a] outline-none placeholder:text-[#97a3b6] focus:border-[#0f4c81]"
              />
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-[#dbe2ec] bg-white px-4 py-2.5 md:w-[270px]">
              <FiSliders className="text-[#0f4c81]" />
              <label className="grow text-[10px] font-bold tracking-[.12em] text-[#64748b]">UP TO {formatINR(maxPrice)}</label>
              <input
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                type="range"
                min="1000"
                max="100000"
                step="1000"
                aria-label="Maximum price"
                className="accent-[#0f4c81]"
              />
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs font-bold text-[#64748b]">
              <span className="text-[#0f4c81]">{shown.length}</span> curated listings found
            </p>
            <button onClick={() => { setQuery(""); setMaxPrice(100000); }} className="text-[10px] font-bold tracking-[.12em] text-[#64748b] hover:text-[#0f172a]">
              RESET FILTERS
            </button>
          </div>

          {shown.length ? (
            <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((item, index) => (
                <motion.article
                  key={item.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  className="group premium-card overflow-hidden rounded-2xl"
                >
                  <div className="relative aspect-[1.22] overflow-hidden">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgba(4,6,5,.9))]" />
                    {item.badge && (
                      <span className="absolute left-4 top-4 rounded border border-white/40 bg-black/40 px-2 py-1 text-[9px] font-black tracking-[.12em] text-white">
                        {item.badge}
                      </span>
                    )}
                    <button
                      onClick={() => toggleWishlist(item.id)}
                      className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg bg-black/45 text-white backdrop-blur"
                      aria-label="Add to wishlist"
                    >
                      {wishlist.includes(item.id) ? <FaHeart /> : <FaRegHeart />}
                    </button>
                    <button
                      onClick={() => setSelected(item)}
                      className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-2 text-[10px] font-bold text-[#0f172a] backdrop-blur"
                    >
                      <FiZoomIn /> QUICK VIEW
                    </button>
                  </div>
                  <div className="p-5">
                    <div className="flex justify-between gap-4">
                      <h2 className="text-[15px] font-black leading-5 text-[#0f172a]">{item.title}</h2>
                      <span className="shrink-0 text-base font-black text-[#0f4c81]">{formatINR(item.price)}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.features.slice(0, 3).map((x) => (
                        <span key={x} className="rounded bg-[#f1f5fb] px-2 py-1 text-[9px] font-bold tracking-wide text-[#64748b]">
                          {x}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => checkout(item)}
                      className="btn-primary mt-5 w-full !py-3.5 text-[11px]"
                    >
                      BUY THIS ACCOUNT
                    </button>
                  </div>
                </motion.article>
              ))}
            </div>
          ) : (
            <div className="mt-7 rounded-2xl border border-dashed border-[#dbe2ec] bg-white/60 py-20 text-center">
              <p className="text-lg font-black text-[#0f172a]">No listings match that search.</p>
              <p className="mt-2 text-sm text-[#64748b]">Try widening the price filter or searching another collection.</p>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-sm"
            onMouseDown={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 10 }}
              onMouseDown={(e) => e.stopPropagation()}
              className="relative max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl border border-[#dbe2ec] bg-white p-3 shadow-2xl"
            >
              <button
                onClick={() => setSelected(null)}
                className="absolute right-5 top-5 z-10 grid h-9 w-9 place-items-center rounded-full bg-[#eef1f6] text-lg text-[#334155]"
              >
                <FiX />
              </button>
              <div className="grid md:grid-cols-2">
                <div className="relative min-h-[300px] overflow-hidden rounded-xl">
                  <img src={selected.image} alt={selected.title} className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
                  <p className="absolute bottom-5 left-5 text-2xl font-black text-[#0f172a]">{formatINR(selected.price)}</p>
                </div>
                <div className="p-6">
                  <p className="text-[10px] font-bold tracking-[.16em] text-[#0f4c81]">ACCOUNT INVENTORY</p>
                  <h2 className="mt-3 text-2xl font-black leading-7 text-[#0f172a]">{selected.title}</h2>
                  <div className="mt-5 grid gap-2">
                    {selected.features.map((f) => (
                      <p key={f} className="flex items-start gap-2 text-xs leading-5 text-[#64748b]">
                        <FiCheck className="mt-0.5 shrink-0 text-[#0e9f6e]" />
                        {f}
                      </p>
                    ))}
                  </div>
                  <div className="mt-7 grid grid-cols-2 gap-3">
                    <button onClick={copy} className="inline-flex items-center justify-center gap-2 rounded-xl btn-outline py-3 text-[10px]">
                      <FiCopy />
                      {copied ? "LINK COPIED" : "COPY LINK"}
                    </button>
                    <button onClick={() => checkout(selected)} className="btn-primary py-3 text-[10px]">
                      BUY NOW
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
