"use client";

import Link from "next/link";
import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { FiArrowLeft, FiLock, FiShield } from "react-icons/fi";
import { GridBackdrop } from "@/components/site-chrome";
import { images } from "@/lib/store-data";
import { safeAuthRedirect } from "@/lib/auth-redirect";

const ERRORS: Record<string, string> = {
  config:
    "Google sign-in is not configured on this server yet — the GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET environment variables are missing.",
  denied: "You cancelled the Google sign-in. Please try again to continue.",
  state: "Your sign-in session expired. Please try again.",
  token: "Google could not verify this sign-in. Please try again.",
  profile: "We could not read your Google profile. Please try again.",
  unverified: "Your Google email address is not verified.",
  disabled: "This account has been disabled by the administrator.",
  forbidden: "You do not have permission to open that page.",
  invalid_request: "Something went wrong during sign-in. Please try again.",
};

export interface AuthViewProps {
  next?: string;
  error?: string;
  signedOut?: boolean;
}

/** Google sign-in screen styled to match the site's light storefront theme. */
export default function AuthView({ next = "/dashboard", error, signedOut }: AuthViewProps) {
  const [busy, setBusy] = useState(false);
  const safeNext = safeAuthRedirect(next);
  const googleHref = `/auth/google?next=${encodeURIComponent(safeNext)}`;

  return (
    <>
      <GridBackdrop />
      <main className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-transparent px-4 py-10 text-[#0f172a] selection:bg-[#0f4c81] selection:text-white">
        <div className="relative z-10 mb-6 flex w-full max-w-md items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold tracking-wider text-[#64748b] transition hover:text-[#0f4c81]"
          >
            <FiArrowLeft className="text-sm" /> BACK TO STORE
          </Link>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/90 px-2.5 py-1 text-[10px] font-black tracking-widest text-emerald-700 shadow-sm uppercase">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            SECURE SIGN-IN
          </span>
        </div>

        <section className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[#dbe2ec] bg-white p-6 shadow-[0_16px_48px_rgba(15,40,70,0.10)] sm:p-8">
          <div className="absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#0f4c81] to-transparent opacity-80" />

          <div className="flex items-center gap-3 border-b border-[#eef1f6] pb-5">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[#e3e9f2] bg-[#f8fafc] p-1 shadow-sm">
              <img
                src={images.logo}
                alt="Battleground Mobile India"
                className="h-full w-full rounded-lg object-cover"
              />
            </div>
            <div>
              <p className="text-[10px] font-black tracking-[.22em] text-[#0f4c81] uppercase">
                BATTLEGROUNDS MOBILE INDIA
              </p>
              <h1 className="text-xl font-black tracking-tight text-[#0f172a]">Player Sign In</h1>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-[#64748b]">
            Sign in to access your BGMI purchases, UC balance, order tracking, and exclusive discounts.
          </p>

          {error && ERRORS[error] && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
              <p className="font-semibold">{ERRORS[error]}</p>
            </div>
          )}
          {signedOut && !error && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
              <p className="font-semibold">You have been signed out successfully.</p>
            </div>
          )}

          <div className="mt-6 space-y-4">
            <a
              href={googleHref}
              onClick={() => setBusy(true)}
              aria-busy={busy}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#dbe2ec] bg-white px-5 py-3.5 text-sm font-black tracking-wide text-[#0f172a] shadow-sm transition hover:border-[#0f4c81] hover:bg-[#f8fafc] hover:shadow-md"
            >
              <FcGoogle className="text-xl" />
              {busy ? "REDIRECTING TO GOOGLE…" : "CONTINUE WITH GOOGLE"}
            </a>
            <p className="flex items-start gap-2 border-t border-[#eef1f6] pt-4 text-[11px] leading-relaxed text-[#64748b]">
              <FiLock className="mt-0.5 shrink-0 text-[#0f4c81]" />
              <span>Secure Google sign-in. Only your verified email and basic public profile are used for your player account.</span>
            </p>
          </div>
        </section>

        <div className="relative z-10 mt-6 flex flex-wrap items-center justify-center gap-4 text-[10px] font-bold text-[#64748b]">
          <span className="flex items-center gap-1.5">
            <FiShield className="text-[#0f4c81]" /> SECURE SIGN-IN
          </span>
          <span aria-hidden="true">•</span>
          <span>GOOGLE PROTECTED</span>
          <span aria-hidden="true">•</span>
          <span>BATTLEGROUNDS MOBILE INDIA STORE</span>
        </div>
      </main>
    </>
  );
}
