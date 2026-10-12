"use client";

import Link from "next/link";
import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { FiArrowLeft, FiLock, FiShield, FiSmartphone, FiUserPlus, FiLogIn } from "react-icons/fi";
import PhoneLogin from "@/components/phone-login";
import { images } from "@/lib/store-data";

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
  mode: "login" | "signup";
  next?: string;
  error?: string;
  signedOut?: boolean;
}

/**
 * Dedicated Sleek Dark Gaming Auth Screen for /login and /signup.
 *
 * Matching the Battleground Mobile India theme:
 * - High-tech cyberpunk dark styling (#070b14, cyan/blue neon glows).
 * - 1-Click Google OAuth sign-in.
 * - Firebase Phone (+91) OTP login workflow with invisible reCAPTCHA.
 * - Seamless toggle between Login and Signup routes with query preservation.
 */
export default function AuthView({ mode, next = "/dashboard", error, signedOut }: AuthViewProps) {
  const [tab, setTab] = useState<"google" | "phone">("phone");
  const [busy, setBusy] = useState(false);

  const googleHref = `/auth/google?next=${encodeURIComponent(next || "/dashboard")}`;
  const isLogin = mode === "login";

  const toggleUrl = isLogin
    ? `/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`
    : `/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <main className="relative min-h-screen w-full bg-[#070b14] text-slate-100 flex flex-col justify-center items-center px-4 py-12 selection:bg-cyan-500 selection:text-black overflow-hidden">
      {/* ── Background Cyber / Gaming Atmosphere ──────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#13233f15_1px,transparent_1px),linear-gradient(to_bottom,#13233f15_1px,transparent_1px)] bg-[size:32px_32px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-[#0f4c81]/25 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-[#38bdf8]/15 blur-[130px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[34rem] w-[34rem] rounded-full bg-[#0a3557]/20 blur-[150px]"
      />

      {/* ── Top Navigation / Back to Store ────────────────────────── */}
      <div className="relative z-10 w-full max-w-md mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-bold tracking-wider text-slate-400 hover:text-cyan-400 transition"
        >
          <FiArrowLeft className="text-sm" /> BACK TO STORE
        </Link>
        <span className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          SYSTEM SECURED
        </span>
      </div>

      {/* ── Main Gaming Auth Container ────────────────────────────── */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-800 bg-[#0d1527]/90 p-6 sm:p-8 shadow-[0_0_50px_rgba(15,76,129,0.25)] backdrop-blur-2xl">
        {/* Glowing Top Accent Rim */}
        <div className="absolute -top-[1px] inset-x-8 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80" />

        {/* Brand Header */}
        <div className="flex items-center gap-3 pb-5 border-b border-slate-800/80">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-700 bg-[#131d31] p-1 shadow-inner">
            <img
              src={images.logo}
              alt="Battleground Mobile India"
              className="h-full w-full object-cover rounded-lg"
            />
          </div>
          <div>
            <p className="text-[10px] font-black tracking-[.25em] text-cyan-400 uppercase">
              BATTLEGROUNDS MOBILE INDIA
            </p>
            <h1 className="text-xl font-black tracking-tight text-white">
              {isLogin ? "Player Sign In" : "Create Player Account"}
            </h1>
          </div>
        </div>

        <p className="mt-4 text-xs leading-5 text-slate-400">
          {isLogin
            ? "Sign in to access your BGMI purchases, UC balance, order tracking, and exclusive discounts."
            : "Register your player account to get instant delivery on UC packages, accounts, and rewards."}
        </p>

        {/* Error / Signed Out Banners */}
        {error && ERRORS[error] && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/70 p-3.5 text-xs text-red-200">
            <p className="font-semibold">{ERRORS[error]}</p>
          </div>
        )}
        {signedOut && !error && (
          <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-950/70 p-3.5 text-xs text-emerald-200">
            <p className="font-semibold">You have been signed out successfully.</p>
          </div>
        )}

        {/* Method Switcher Tabs (Phone OTP is prioritized as requested, with Google available) */}
        <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-[#080d18] p-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "phone"}
            onClick={() => setTab("phone")}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-[11px] font-black tracking-wider transition ${
              tab === "phone"
                ? "bg-gradient-to-r from-[#0f4c81] to-[#1e6fbe] text-white shadow-[0_2px_12px_rgba(15,76,129,0.5)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <FiSmartphone className="text-base text-cyan-300" /> +91 MOBILE OTP
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "google"}
            onClick={() => setTab("google")}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-[11px] font-black tracking-wider transition ${
              tab === "google"
                ? "bg-gradient-to-r from-[#0f4c81] to-[#1e6fbe] text-white shadow-[0_2px_12px_rgba(15,76,129,0.5)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <FcGoogle className="text-base" /> GOOGLE AUTH
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-5">
          {tab === "google" ? (
            <div className="space-y-4">
              <a
                href={googleHref}
                onClick={() => setBusy(true)}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-[#131d31] hover:bg-[#1a2742] hover:border-cyan-500/50 px-5 py-3.5 text-sm font-black tracking-wide text-white shadow-lg transition"
              >
                <FcGoogle className="text-xl" />
                {busy
                  ? "REDIRECTING TO GOOGLE…"
                  : isLogin
                  ? "CONTINUE WITH GOOGLE"
                  : "SIGN UP WITH GOOGLE"}
              </a>
              <p className="flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed pt-2">
                <FiLock className="mt-0.5 shrink-0 text-cyan-400" />
                <span>1-Click Google OAuth. Only your basic public profile and email are retrieved.</span>
              </p>
            </div>
          ) : (
            <PhoneLogin next={next} mode={mode} />
          )}
        </div>

        {/* ── Toggle between Login and Signup ─────────────────────── */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
          <p className="text-xs text-slate-400">
            {isLogin ? "Don't have a player account yet? " : "Already have a player account? "}
            <Link
              href={toggleUrl}
              className="inline-flex items-center gap-1 font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-4 transition"
            >
              {isLogin ? (
                <>
                  <FiUserPlus className="text-xs" /> Sign up here
                </>
              ) : (
                <>
                  <FiLogIn className="text-xs" /> Sign in here
                </>
              )}
            </Link>
          </p>
        </div>
      </div>

      {/* Footer Trust Badges */}
      <div className="relative z-10 mt-6 flex flex-wrap items-center justify-center gap-4 text-[10px] font-bold text-slate-500">
        <span className="flex items-center gap-1.5">
          <FiShield className="text-cyan-400" /> 256-BIT ENCRYPTION
        </span>
        <span>•</span>
        <span>INSTANT SMS VERIFICATION</span>
        <span>•</span>
        <span>OFFICIAL BGMI STORE</span>
      </div>
    </main>
  );
}
