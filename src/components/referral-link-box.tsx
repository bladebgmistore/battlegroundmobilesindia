"use client";

import { useState, useSyncExternalStore } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { FiCheck, FiCopy } from "react-icons/fi";
import { copyToClipboard } from "@/lib/clipboard";
import { referralLinkPath } from "@/lib/referral-config";

const subscribeToNothing = () => () => undefined;
const readOrigin = () => window.location.origin;
const serverOrigin = () => "";

/**
 * The shareable Refer & Earn link with a COPY button and a WhatsApp share.
 * The origin is read from the browser, so the link always uses the visitor's domain.
 */
export function ReferralLinkBox({ code, variant = "light" }: { code: string; variant?: "light" | "dark" }) {
  const origin = useSyncExternalStore(subscribeToNothing, readOrigin, serverOrigin);
  const [copied, setCopied] = useState(false);

  const link = `${origin}${referralLinkPath(code)}`;
  const shareText = `Join the Battleground Mobile India Store with my referral link and get the best BGMI deals: ${link}`;
  const dark = variant === "dark";

  const copy = async () => {
    if (await copyToClipboard(link)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-3">
      <div className={`flex flex-col gap-2 rounded-xl border p-2 sm:flex-row ${dark ? "border-white/25 bg-white/10" : "border-[#dbe2ec] bg-white"}`}>
        <input
          readOnly
          aria-label="Your referral link"
          value={link}
          onFocus={(event) => event.currentTarget.select()}
          className={`min-w-0 flex-1 rounded-lg bg-transparent px-3 py-2.5 text-sm font-semibold outline-none ${dark ? "text-white placeholder:text-white/60" : "text-[#0f172a]"}`}
        />
        <button
          type="button"
          onClick={copy}
          className={`flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-xs font-black tracking-[.12em] transition ${
            dark ? "bg-white text-[#0f4c81] hover:bg-[#e0eefb]" : "btn-primary !py-2.5"
          }`}
        >
          {copied ? <FiCheck /> : <FiCopy />} {copied ? "COPIED" : "COPY LINK"}
        </button>
      </div>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 text-xs font-black tracking-[.12em] ${dark ? "text-white/90 hover:text-white" : "text-[#16a34a] hover:text-[#15803d]"}`}
      >
        <FaWhatsapp className="text-base" /> SHARE ON WHATSAPP
      </a>
    </div>
  );
}
