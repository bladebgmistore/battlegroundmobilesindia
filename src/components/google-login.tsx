"use client";

import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { FiLock, FiShield } from "react-icons/fi";

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
 * The single entry point to the site: "Continue with Google".
 * `next` is preserved so the user lands back on the page they wanted.
 */
export default function GoogleLogin({ next, error, signedOut }: { next: string; error?: string; signedOut?: boolean }) {
  const [busy, setBusy] = useState(false);
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
          Battleground Mobile India Store is a members-only store. Sign in with your Google account to browse
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

        <a
          href={href}
          onClick={() => setBusy(true)}
          className="mt-7 flex w-full items-center justify-center gap-3 rounded-xl border border-[#dbe2ec] bg-white px-5 py-4 text-sm font-black tracking-[.04em] text-[#0f172a] shadow-sm transition hover:border-[#0f4c81] hover:shadow-md"
        >
          <FcGoogle className="text-xl" />
          {busy ? "REDIRECTING TO GOOGLE…" : "CONTINUE WITH GOOGLE"}
        </a>

        <p className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-[#94a3b8]">
          <FiLock className="mt-0.5 shrink-0" />
          We only receive your name, email address and profile picture from Google. We never see your password.
        </p>
      </div>
    </main>
  );
}
