"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiArrowRight, FiGift, FiX } from "react-icons/fi";
import { ReferralLinkBox } from "@/components/referral-link-box";
import { WELCOME_COOKIE, REFERRAL_COMMISSION_PERCENT } from "@/lib/referral-config";

const hasWelcomeFlag = () => document.cookie.split(";").some((part) => part.trim() === `${WELCOME_COOKIE}=1`);

const clearWelcomeFlag = () => {
  document.cookie = `${WELCOME_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
};

/**
 * "Refer & Win" pop-up shown once, right after a successful Google sign-in.
 * The OAuth callback sets a short-lived welcome flag; this component reads it,
 * fetches the signed-in user's referral code and shows it with a copy button.
 */
export default function ReferWinPopup() {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    if (!hasWelcomeFlag()) return;
    let alive = true;
    fetch("/api/referrals", { cache: "no-store", credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { referralCode?: string | null } | null) => {
        if (alive && data?.referralCode) setCode(data.referralCode);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (!code) return null;

  const close = () => {
    clearWelcomeFlag();
    setCode(null);
  };

  return (
    <div
      className="modal-overlay fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={close}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="refer-win-title"
        onClick={(event) => event.stopPropagation()}
        className="modal-card w-full max-w-md overflow-hidden rounded-2xl border border-[#dbe2ec] bg-white shadow-[0_30px_80px_rgba(15,40,70,.3)]"
      >
        <div className="relative bg-gradient-to-br from-[#0f4c81] to-[#1b6fb0] p-6 text-white">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            <FiX />
          </button>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-2xl">
            <FiGift />
          </span>
          <p className="mt-4 text-[10px] font-black tracking-[.22em] text-[#ffd76a]">REFER &amp; WIN</p>
          <h2 id="refer-win-title" className="mt-1 text-2xl font-black tracking-[-.03em]">
            Invite friends, earn points
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/85">
            You earn {REFERRAL_COMMISSION_PERCENT}% of every purchase your friends confirm, as points. Redeem points for UC in the Points Store.
          </p>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <p className="mb-2 text-[10px] font-black tracking-[.16em] text-[#64748b]">YOUR REFERRAL LINK</p>
            <ReferralLinkBox code={code} />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/refer-earn"
              onClick={close}
              className="btn-primary flex-1 justify-center py-3 text-xs font-black tracking-[.12em]"
            >
              VIEW REFER &amp; EARN <FiArrowRight />
            </Link>
            <button
              type="button"
              onClick={close}
              className="btn-outline flex-1 justify-center py-3 text-xs font-black tracking-[.12em]"
            >
              MAYBE LATER
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
