"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiArrowUpRight, FiInstagram, FiMenu, FiShield, FiX, FiYoutube } from "react-icons/fi";
import { UserNav, UserMobileAuth } from "@/components/user-nav";
import { NotificationBell } from "@/components/notification-bell";
import { CartButton } from "@/components/cart-button";
import {
  DEFAULT_CATEGORY_NAV,
  categoryHref,
  categoryLabel,
  isCategoryVisible,
  pageHref,
} from "@/lib/catalog";
import type { Category, StorePage } from "@/lib/store-data";
import { images } from "@/lib/store-data";
import { useStoreCatalog } from "@/lib/use-store-catalog";
import { useStoreSettings } from "@/lib/use-store-settings";

type NavItem = { slug: string; label: string; href: string };

/**
 * Turn active category rows into navigation entries.
 *
 * If the catalog request failed (or the database is unavailable) we keep the
 * canonical four entries instead of rendering an empty menu — a database
 * hiccup must never make the category system disappear from the public site.
 */
function buildCategoryNav(categories: Category[], databaseOnline: boolean, loading: boolean): NavItem[] {
  if (categories.length === 0 && (loading || !databaseOnline)) return DEFAULT_CATEGORY_NAV;
  return categories
    .filter(isCategoryVisible)
    .map((category) => ({
      slug: category.slug,
      label: categoryLabel(category),
      href: categoryHref(category.slug),
    }));
}

function buildPageNav(pages: StorePage[]): NavItem[] {
  return pages
    .filter((page) => page.isActive !== false && page.isPublished !== false && page.showInNav)
    .map((page) => ({
      slug: page.slug,
      label: page.title || page.slug,
      href: pageHref(page.slug),
    }));
}

const STATIC_NAV: { label: string; href: string }[] = [
  { label: "Home", href: "/" },
  { label: "How To Buy", href: "/how-to-buy" },
  { label: "Refer & Earn", href: "/refer-earn" },
  { label: "Verified Proofs", href: "/proofs" },
];

/* Soft, light premium backdrop */
export function GridBackdrop() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setScrollY(window.scrollY));
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#eef1f6]">
      <div className="animated-bg-mesh absolute inset-[-22%]" />
      <div className="animated-bg-scan absolute inset-[-35%] opacity-70" />
      <div
        className="absolute inset-[-22%] bg-[linear-gradient(rgba(15,76,129,.052)_1px,transparent_1px),linear-gradient(90deg,rgba(15,76,129,.052)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]"
        style={{ transform: `translate3d(${scrollY * -0.025}px, ${scrollY * -0.14}px, 0)` }}
      />
      <div
        className="hero-glow absolute -left-32 top-10 h-[30rem] w-[30rem] rounded-full bg-[#0f4c81]/[.105] blur-[115px]"
        style={{ transform: `translate3d(${scrollY * 0.045}px, ${scrollY * 0.075}px, 0)` }}
      />
      <div
        className="absolute right-[-12rem] top-[28rem] h-[38rem] w-[38rem] rounded-full bg-[#0a3557]/[.085] blur-[125px]"
        style={{ transform: `translate3d(${scrollY * -0.055}px, ${scrollY * -0.065}px, 0)` }}
      />
      <div
        className="absolute left-1/2 top-[48rem] h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[#38bdf8]/[.16] blur-[105px]"
        style={{ transform: `translate3d(-50%, ${scrollY * -0.095}px, 0)` }}
      />
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { maintenance, settings, whatsappEnabled } = useStoreSettings();
  // Live catalogue navigation: admin-created categories and nav-visible pages
  // are included automatically, in their configured sort order.
  const { categories, pages, databaseOnline, loading: catalogLoading } = useStoreCatalog();
  const logoUrl = settings.logo_url;

  const categoryNav = useMemo(
    () => buildCategoryNav(categories, databaseOnline, catalogLoading),
    [categories, databaseOnline, catalogLoading],
  );
  const pageNav = useMemo(() => buildPageNav(pages), [pages]);

  const navLinks: [string, string][] = useMemo(() => {
    const staticLinks = STATIC_NAV.map((n) => [n.label, n.href] as [string, string]);
    const dynamicLinks = [...categoryNav, ...pageNav].map((n) => [n.label, n.href] as [string, string]);
    const seen = new Set(staticLinks.map(([, href]) => href));
    const uniqueDynamic = dynamicLinks.filter(([, href]) => {
      if (seen.has(href)) return false;
      seen.add(href);
      return true;
    });
    return [...staticLinks, ...uniqueDynamic];
  }, [categoryNav, pageNav]);

  return (
    <>
      {maintenance && (
        <div className="relative z-50 flex items-center justify-center gap-2 bg-[#f4b400] px-4 py-2 text-[10px] font-bold tracking-wide text-[#231a02]">
          <FiAlertTriangle className="text-sm" />
          {whatsappEnabled ? "PAYMENT GATEWAY IS UNDER MAINTENANCE — PLEASE USE OFFICIAL WHATSAPP FOR ALL ORDERS" : "PAYMENT GATEWAY IS UNDER MAINTENANCE — PLEASE CONTACT SUPPORT FOR ALL ORDERS"}
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-[#dbe2ec] bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="group flex items-center gap-3" aria-label="Battleground Mobile India Store home">
            <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl border border-[#e3e9f2] bg-white shadow-sm">
              <img src={logoUrl || images.logo} alt="Battleground Mobile India Store emblem" className="h-full w-full object-cover" />
            </span>
            <span className="leading-none">
              <span className="block text-[10px] font-bold tracking-[.22em] text-[#0f4c81]">BATTLEGROUNDS MOBILE</span>
              <span className="mt-1 block text-sm font-extrabold tracking-[.12em] text-[#0f172a]">INDIA STORE</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            {navLinks.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
                  pathname === href ? "bg-[#e0eefb] text-[#0f4c81]" : "text-[#334155] hover:bg-[#f1f5fb] hover:text-[#0f172a]"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {/* Cart lives outside the `hidden sm:flex` group so the icon (and its
                live badge) is always reachable — including on phones. */}
            <CartButton />
            <div className="hidden items-center gap-3 sm:flex">
              <NotificationBell />
              <UserNav />
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="grid h-10 w-10 place-items-center rounded-lg border border-[#dbe2ec] text-xl text-[#334155] lg:hidden"
              aria-label="Toggle menu"
            >
              {isOpen ? <FiX /> : <FiMenu />}
            </button>
          </div>
        </div>
        {isOpen && (
          <div className="border-t border-[#dbe2ec] bg-white px-5 py-4 lg:hidden">
            <div className="mx-auto flex max-w-7xl justify-end">
              <NotificationBell />
            </div>
            <nav className="mx-auto grid max-w-7xl gap-1">
              {navLinks.map(([label, href]) => (
                <Link
                  onClick={() => setIsOpen(false)}
                  key={href}
                  href={href}
                  className={`rounded-lg px-3 py-3 text-sm font-semibold ${pathname === href ? "bg-[#e0eefb] text-[#0f4c81]" : "text-[#334155]"}`}
                >
                  {label}
                </Link>
              ))}
            </nav>
            <UserMobileAuth />
          </div>
        )}
      </header>
    </>
  );
}

export function SiteFooter() {
  const { settings, whatsappEnabled } = useStoreSettings();
  const { categories, pages, databaseOnline, loading: catalogLoading } = useStoreCatalog();

  const footerCategories = useMemo(
    () => buildCategoryNav(categories, databaseOnline, catalogLoading),
    [categories, databaseOnline, catalogLoading],
  );
  const footerPages = useMemo(() => buildPageNav(pages), [pages]);

  return (
    <footer className="mt-20 border-t border-[#dbe2ec] bg-white/70">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1.35fr_.7fr_.7fr] lg:px-8">
        <div>
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl border border-[#e3e9f2] bg-white"><img src={settings.logo_url || images.logo} alt="" className="h-full w-full object-cover" /></span>
            <span className="text-sm font-extrabold tracking-[.14em] text-[#0f172a]">BATTLEGROUNDS MOBILE <span className="text-[#0f4c81]">INDIA</span></span>
          </Link>
          <p className="mt-5 max-w-md text-sm leading-6 text-[#64748b]">
            A refined digital marketplace built for the BGMI community. Clear listing details, guided handovers, and {whatsappEnabled ? "prompt WhatsApp support" : "prompt order-based support"}.
          </p>
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#e3e9f2] bg-[#f8fafc] p-3 text-xs leading-5 text-[#64748b]">
            <FiShield className="mt-0.5 shrink-0 text-base text-[#0f4c81]" />
            <span>Independent BGMI digital marketplace. Not affiliated with or endorsed by Krafton or BGMI.</span>
          </div>
          {(settings.instagram_url || settings.youtube_url) && (
            <div className="mt-5 flex gap-2">
              {settings.instagram_url && <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="grid h-9 w-9 place-items-center rounded-lg border border-[#dbe2ec] text-[#64748b] transition hover:border-[#0f4c81] hover:text-[#0f4c81]"><FiInstagram /></a>}
              {settings.youtube_url && <a href={settings.youtube_url} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="grid h-9 w-9 place-items-center rounded-lg border border-[#dbe2ec] text-[#64748b] transition hover:border-[#0f4c81] hover:text-[#0f4c81]"><FiYoutube /></a>}
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-bold tracking-[.16em] text-[#0f4c81]">EXPLORE</p>
          <div className="mt-5 grid gap-3 text-sm text-[#64748b]">
            {footerCategories.map((item) => (
              <Link key={item.slug} href={item.href} className="hover:text-[#0f172a]">{item.label}</Link>
            ))}
            {footerPages.map((item) => (
              <Link key={item.slug} href={item.href} className="hover:text-[#0f172a]">{item.label}</Link>
            ))}
            <Link href="/how-to-buy" className="hover:text-[#0f172a]">How to Buy</Link>
            <Link href="/proofs" className="hover:text-[#0f172a]">Verified Proofs</Link>
          </div>
        </div>
        <div>
          <p className="text-xs font-bold tracking-[.16em] text-[#0f4c81]">LEGAL & HELP</p>
          <div className="mt-5 grid gap-3 text-sm text-[#64748b]">
            <Link href="/terms" className="hover:text-[#0f172a]">Terms & Conditions</Link>
            <Link href="/refund-policy" className="hover:text-[#0f172a]">Refund Policy</Link>
            <Link href="/contact" className="hover:text-[#0f172a]">Contact Support</Link>
            <Link href="/admin" className="inline-flex items-center gap-1 hover:text-[#0f172a]">Admin access <FiArrowUpRight /></Link>
          </div>
        </div>
      </div>
      <div className="border-t border-[#dbe2ec] px-5 py-5 text-center text-[11px] font-medium tracking-wide text-[#94a3b8]">
        © {new Date().getFullYear()} BATTLEGROUNDS MOBILE INDIA STORE · COMMUNITY MARKETPLACE
      </div>
    </footer>
  );
}

export function PageTitle({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-8 pt-16 lg:px-8 lg:pt-20">
      <p data-aos="fade-up" className="text-[11px] font-bold tracking-[.22em] text-[#0f4c81]">{eyebrow}</p>
      <h1 data-aos="fade-up" data-aos-delay="80" className="mt-4 max-w-3xl text-4xl font-black leading-[1.02] tracking-[-.04em] text-[#0f172a] sm:text-5xl">{title}</h1>
      <p data-aos="fade-up" data-aos-delay="150" className="mt-5 max-w-2xl text-base leading-7 text-[#64748b]">{copy}</p>
    </section>
  );
}
