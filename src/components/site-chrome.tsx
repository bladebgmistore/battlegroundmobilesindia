"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FiAlertTriangle, FiArrowUpRight, FiInstagram, FiMenu, FiShield, FiX, FiYoutube } from "react-icons/fi";
import { images } from "@/lib/store-data";
import { useStoreSettings } from "@/lib/use-store-settings";

const navLinks = [
  ["Home", "/"],
  ["Accounts", "/accounts"],
  ["UC Purchase", "/uc-purchase"],
  ["Super-Car", "/category/super-car"],
  ["X-Suit", "/category/x-suit"],
  ["Is It Safe?", "/is-it-safe"],
  ["How To Buy", "/how-to-buy"],
];

/* Soft, light premium backdrop */
export function GridBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#eef1f6]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,76,129,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,76,129,.035)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />
      <div className="hero-glow absolute -left-32 top-10 h-[30rem] w-[30rem] rounded-full bg-[#0f4c81]/[.07] blur-[120px]" />
      <div className="absolute right-[-12rem] top-[28rem] h-[38rem] w-[38rem] rounded-full bg-[#f4b400]/[.07] blur-[130px]" />
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { maintenance, settings } = useStoreSettings();
  const logoUrl = settings.logo_url;

  return (
    <>
      {maintenance && (
        <div className="relative z-50 flex items-center justify-center gap-2 bg-[#f4b400] px-4 py-2 text-[10px] font-bold tracking-wide text-[#231a02]">
          <FiAlertTriangle className="text-sm" /> PAYMENT GATEWAY IS UNDER MAINTENANCE — PLEASE USE OFFICIAL WHATSAPP FOR ALL ORDERS
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-[#dbe2ec] bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="group flex items-center gap-3" aria-label="Battleground Mobile India Store home">
            <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl border border-[#e3e9f2] bg-white shadow-sm">
              <img src={logoUrl || images.logo} alt="Battleground Mobile India Store emblem" className="h-full w-full object-cover" />
            </span>
            <span className="leading-none">
              <span className="block text-[10px] font-bold tracking-[.22em] text-[#0f4c81]">BATTLEGORUND MOBILE</span>
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

          <div className="hidden items-center gap-3 sm:flex">
            {/* Login and Support links removed from top navigation */}
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
        {isOpen && (
          <div className="border-t border-[#dbe2ec] bg-white px-5 py-4 lg:hidden">
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
            {/* Mobile login action removed */}
          </div>
        )}
      </header>
    </>
  );
}

export function SiteFooter() {
  const { settings } = useStoreSettings();
  return (
    <footer className="mt-20 border-t border-[#dbe2ec] bg-white/70">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1.35fr_.7fr_.7fr] lg:px-8">
        <div>
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl border border-[#e3e9f2] bg-white"><img src={settings.logo_url || images.logo} alt="" className="h-full w-full object-cover" /></span>
            <span className="text-sm font-extrabold tracking-[.14em] text-[#0f172a]">BATTLEGORUND MOBILE <span className="text-[#0f4c81]">INDIA</span></span>
          </Link>
          <p className="mt-5 max-w-md text-sm leading-6 text-[#64748b]">A refined digital marketplace built for the BGMI community. Clear listing details, guided handovers, and prompt WhatsApp support.</p>
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
            <Link href="/accounts" className="hover:text-[#0f172a]">Premium Accounts</Link>
            <Link href="/uc-purchase" className="hover:text-[#0f172a]">UC Purchase</Link>
            <Link href="/#super-cars" className="hover:text-[#0f172a]">Super Cars</Link>
            <Link href="/#x-suits" className="hover:text-[#0f172a]">X-Suits</Link>
            <Link href="/is-it-safe" className="hover:text-[#0f172a]">Safety Centre</Link>
            <Link href="/how-to-buy" className="hover:text-[#0f172a]">How to Buy</Link>
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
        © {new Date().getFullYear()} BATTLEGORUND MOBILE INDIA STORE · COMMUNITY MARKETPLACE
      </div>
    </footer>
  );
}

export function PageTitle({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-8 pt-16 lg:px-8 lg:pt-20">
      <p className="text-[11px] font-bold tracking-[.22em] text-[#0f4c81]">{eyebrow}</p>
      <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[1.02] tracking-[-.04em] text-[#0f172a] sm:text-5xl">{title}</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-[#64748b]">{copy}</p>
    </section>
  );
}
