"use client";

import Link from "next/link";
import { FiLock, FiShield } from "react-icons/fi";

/**
 * Legacy Google login component — now redirects to Clerk.
 * Kept for backward compatibility if any page still imports it.
 */
export default function GoogleLogin({ next, error, signedOut }: { next: string; error?: string; signedOut?: boolean }) {
  const target = next?.startsWith("/") ? next : "/dashboard";

  return (
    <main className="grid min-h-screen place-items-center bg-[#eef1f6] px-5 py-16">
      <div className="w-full max-w-md rounded-2xl border border-[#e3e9f2] bg-white p-8 shadow-xl">
        <div className="flex items-center gap-2 text-[#0f4c81]">
          <FiShield />
          <p className="text-[10px] font-black tracking-[.2em]">SECURE ACCESS - CLERK</p>
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-[-.03em] text-[#0f172a]">Sign in moved</h1>
        <p className="mt-3 text-sm leading-6 text-[#64748b]">
          Authentication is now powered by Clerk — supporting Google, Email OTP and Phone OTP.
          You will be redirected to the new sign-in page.
        </p>

        {signedOut && (
          <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
            You have been signed out successfully.
          </p>
        )}

        <Link
          href={`/sign-in?redirect_url=${encodeURIComponent(target)}`}
          className="mt-7 flex w-full items-center justify-center gap-3 rounded-xl bg-[#0f4c81] px-5 py-4 text-sm font-black tracking-[.04em] text-white shadow-sm transition hover:bg-[#0a3557]"
        >
          GO TO CLERK SIGN IN
        </Link>

        <p className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-[#94a3b8]">
          <FiLock className="mt-0.5 shrink-0" />
          Clerk supports Google, Email Magic Link / OTP and Phone SMS OTP — enable them in Clerk Dashboard.
        </p>
      </div>
    </main>
  );
}
