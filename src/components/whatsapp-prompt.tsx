"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FiAlertCircle, FiCheckCircle, FiMessageCircle, FiX } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";
import { WhatsappInput, isCompleteWhatsapp } from "@/components/whatsapp-input";
import { formatWhatsapp, splitWhatsapp } from "@/lib/phone";
import {
  SIGNUP_COOKIE,
  WHATSAPP_PROMPT_DISMISS_KEY,
  WHATSAPP_PROMPT_REMIND_MS,
} from "@/lib/profile-config";

const readCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
};

const clearCookie = (name: string) => {
  document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
};

const recentlyDismissed = (): boolean => {
  try {
    const raw = localStorage.getItem(WHATSAPP_PROMPT_DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < WHATSAPP_PROMPT_REMIND_MS;
  } catch {
    return false;
  }
};

const rememberDismissal = () => {
  try {
    localStorage.setItem(WHATSAPP_PROMPT_DISMISS_KEY, String(Date.now()));
  } catch {
    // private mode — nothing to remember
  }
};

type Me = { id: string; name: string; email: string | null; whatsapp: string | null };

/**
 * Post-signup WhatsApp prompt.
 *
 * A brand-new account (flagged by the OAuth callback) is asked for its active
 * WhatsApp number immediately, with full country-code support. Signed-in users
 * with no saved number are reminded at most once a week. The number is written
 * to `users.whatsapp` through /api/account/profile — nothing is ever prefilled
 * with dummy data.
 */
export default function WhatsappPrompt() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isNewAccount, setIsNewAccount] = useState(false);
  const [user, setUser] = useState<Me | null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const close = useCallback((remember: boolean) => {
    clearCookie(SIGNUP_COOKIE);
    if (remember) rememberDismissal();
    setOpen(false);
    setError("");
  }, []);

  useEffect(() => {
    // The admin control centre never nags staff about a buyer phone number.
    if (pathname?.startsWith("/admin")) return;

    let alive = true;
    const signupFlag = readCookie(SIGNUP_COOKIE) === "1";

    (async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" });
        const data = await response.json().catch(() => null);
        if (!alive || !data?.authenticated || !data.user) return;

        const me = data.user as Me;
        if (me.whatsapp) {
          // Already has a number — nothing to ask.
          if (signupFlag) clearCookie(SIGNUP_COOKIE);
          return;
        }

        setUser(me);
        if (signupFlag || !recentlyDismissed()) {
          setIsNewAccount(signupFlag);
          setPhone("");
          setOpen(true);
        }
      } catch {
        // offline — try again on the next page load
      }
    })();

    return () => {
      alive = false;
    };
  }, [pathname]);

  if (!open || !user) return null;

  const complete = isCompleteWhatsapp(phone);
  const { dial, local } = splitWhatsapp(phone);
  const digitsLeft = dial === "+91" ? Math.max(0, 10 - local.length) : 0;
  const hint = !local
    ? "Pick your country code, then enter the number without the leading zero."
    : complete
      ? "Looks good — save it to receive order updates."
      : digitsLeft > 0
        ? `${digitsLeft} more digit${digitsLeft === 1 ? "" : "s"} needed.`
        : "Enter the full number for the selected country.";

  const save = async () => {
    if (!complete || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp: phone }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.user) {
        setError(data?.error ?? "Could not save your WhatsApp number. Please try again.");
        return;
      }
      setSaved(formatWhatsapp(data.user.whatsapp));
      clearCookie(SIGNUP_COOKIE);
      // Let the account page / header refresh their copy of the profile.
      window.dispatchEvent(new CustomEvent("bgmi:profile-updated", { detail: data.user }));
      setTimeout(() => setOpen(false), 1600);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[85] grid place-items-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm sm:p-4"
      // Only a real tap on the backdrop closes the dialog — a scroll gesture
      // that happens to end outside the card must not dismiss it mid-typing.
      onClick={(event) => {
        if (event.target === event.currentTarget && !saved) close(true);
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whatsapp-prompt-title"
        onClick={(event) => event.stopPropagation()}
        className="my-auto w-full max-w-md overflow-hidden rounded-2xl border border-[#dbe2ec] bg-white shadow-[0_30px_80px_rgba(15,40,70,.3)]"
      >
        <div className="relative bg-gradient-to-br from-[#0f4c81] to-[#1b6fb0] p-6 text-white">
          {!saved && (
            <button
              type="button"
              onClick={() => close(true)}
              aria-label="Close"
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/15 transition hover:bg-white/25"
            >
              <FiX />
            </button>
          )}
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-2xl">
            <FaWhatsapp />
          </span>
          <p className="mt-4 text-[10px] font-black tracking-[.22em] text-[#ffd76a]">
            {isNewAccount ? "WELCOME TO THE STORE" : "ONE QUICK THING"}
          </p>
          <h2 id="whatsapp-prompt-title" className="mt-1 text-2xl font-black tracking-[-.03em]">
            {isNewAccount ? "Add your WhatsApp number" : "Keep your orders updated"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/85">
            We send order confirmations, delivery updates and UC receipts on WhatsApp.
            {isNewAccount ? " Save your active number now so nothing gets missed." : " No number is saved on your account yet."}
          </p>
        </div>

        <div className="space-y-4 p-6">
          {saved ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <FiCheckCircle className="mx-auto text-2xl text-[#0e9f6e]" />
              <p className="mt-2 text-sm font-black text-[#0f172a]">WhatsApp number saved</p>
              <p className="mt-1 font-mono text-sm font-bold text-[#0e9f6e]">{saved}</p>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <div>
                <label htmlFor="signup-whatsapp" className="mb-2 block text-[10px] font-black tracking-[.14em] text-[#334155]">
                  ACTIVE WHATSAPP NUMBER
                </label>
                <WhatsappInput
                  id="signup-whatsapp"
                  value={phone}
                  onChange={(next) => { setPhone(next); setError(""); }}
                  placeholder="98765 43210"
                  autoFocus
                  invalid={Boolean(error)}
                />
                <p
                  aria-live="polite"
                  className={`mt-2 flex items-start gap-1.5 text-[11px] leading-4 ${
                    complete ? "font-bold text-[#0e9f6e]" : "text-[#64748b]"
                  }`}
                >
                  {complete ? (
                    <FiCheckCircle className="mt-0.5 shrink-0" />
                  ) : (
                    <FiAlertCircle className="mt-0.5 shrink-0 text-[#0f4c81]" />
                  )}
                  <span>{hint}</span>
                </p>
              </div>

              {error && (
                <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-bold text-red-600">
                  <FiAlertCircle /> {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!complete || busy}
                className="btn-primary w-full justify-center py-3.5 text-xs font-black tracking-[.12em] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiMessageCircle /> {busy ? "SAVING…" : "SAVE WHATSAPP NUMBER"}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className="w-full text-center text-[10px] font-black tracking-[.14em] text-[#94a3b8] transition hover:text-[#0f172a]"
              >
                SKIP FOR NOW
              </button>
              <p className="text-center text-[10px] leading-4 text-[#94a3b8]">
                You can change or remove this number anytime from Profile &amp; Security.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
