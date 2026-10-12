"use client";

import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { FiLock, FiShield, FiSmartphone } from "react-icons/fi";
import PhoneLogin from "@/components/phone-login";

const ERRORS: Record<string, string> = {
  config:
    "Google sign-in is not configured on this server yet — the GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET environment variables are missing. Add them in your hosting dashboard and redeploy.",
  denied: "You cancelled the Google sign-in. Please try again to continue.",
  state: "Your sign-in session expired. Please try again.",
  token: "Google could not verify this sign-in. Please try again.",
  profile: "We could not read your Google profile. Please try again.",
  unverified: "Your Google email address is not verified.",
  disabled: "This account has been disabled by the administrator.",
  forbidden: "You do not have permission to open that page.",
  invalid_request: "Something went wrong during sign-in. Please try again.",
};

/**
 * The entry point to the site.
 *
 * Two sign-in methods share this one card:
 *   • GOOGLE      — the existing OAuth 2.0 / PKCE flow (unchanged, default tab)
 *   • MOBILE OTP  — Firebase Phone Auth for +91 numbers (see phone-login.tsx)
 *
 * `next` is preserved so the user lands back on the page they wanted.
 */
export default function GoogleLogin({ next, error, signedOut }: { next: string; error?: string; signedOut?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"google" | "phone">("google");
  const href = `/auth/google?next=${encodeURIComponent(next || "/dashboard")}`;

  return (
    <main className="grid min-h-screen place-items-center bg-[#eef1f6] px-5 py-16">
      <div className="w-full max-w-md rounded-2xl border border-[#e3e9f2] bg-white p-8 shadow-xl">
        <div className="flex items-center gap-2 text-[#0f4c81]">
          <FiShield />
          <p className="text-[10px] font-black tracking-[.2em]">SECURE ACCESS</p>
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-[-.03em] text-[#0f172a]">Sign in to continue</h1>
        <p className="mt-3 text-sm leading-6 text-[#64748b]">
          Battleground Mobile India Store is a members-only store. Sign in with Google or your +91 mobile number to browse
          products, place orders and track your purchases.
        </p>

        {error && ERRORS[error] && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
            <p>{ERRORS[error]}</p>
            {error === "config" && (
              <a href="/api/auth/config-check" className="mt-2 inline-block underline">
                Run the configuration check →
              </a>
            )}
          </div>
        )}
        {signedOut && !error && (
          <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
            You have been signed out successfully.
          </p>
        )}

        {/* Method switcher — Google stays the default tab, exactly as before. */}
        <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-[#e3e9f2] bg-[#f6f9fd] p-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "google"}
            onClick={() => setTab("google")}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[10px] font-black tracking-[.12em] transition ${
              tab === "google" ? "bg-white text-[#0f172a] shadow-sm" : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            <FcGoogle className="text-base" /> GOOGLE
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "phone"}
            onClick={() => setTab("phone")}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[10px] font-black tracking-[.12em] transition ${
              tab === "phone" ? "bg-white text-[#0f172a] shadow-sm" : "text-[#64748b] hover:text-[#0f172a]"
            }`}
          >
            <FiSmartphone className="text-base" /> MOBILE OTP
          </button>
        </div>

        {tab === "google" ? (
          <div className="fade-in">
            <a
              href={href}
              onClick={() => setBusy(true)}
              className="mt-4 flex w-full items-center justify-center gap-3 rounded-xl border border-[#dbe2ec] bg-white px-5 py-4 text-sm font-black tracking-[.04em] text-[#0f172a] shadow-sm transition hover:border-[#0f4c81] hover:shadow-md"
            >
              <FcGoogle className="text-xl" />
              {busy ? "REDIRECTING TO GOOGLE…" : "CONTINUE WITH GOOGLE"}
            </a>

            <p className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-[#94a3b8]">
              <FiLock className="mt-0.5 shrink-0" />
              We only receive your name, email address and profile picture from Google. We never see your password.
            </p>
          </div>
        ) : (
          <div className="fade-in">
            <PhoneLogin next={next} />
          </div>
        )}
      </div>
    </main>
  );
}
