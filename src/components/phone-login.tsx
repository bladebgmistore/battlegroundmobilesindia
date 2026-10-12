"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiCheckCircle, FiEdit2, FiLoader, FiLock, FiRefreshCw, FiShield, FiSmartphone } from "react-icons/fi";
import type { ConfirmationResult, RecaptchaVerifier } from "firebase/auth";
import { FIREBASE_PHONE_AUTH_ENABLED, createInvisibleRecaptcha, getFirebaseAuth } from "@/lib/firebase";
import { firebasePhoneAuthMessage, isOtpMismatch } from "@/lib/firebase-errors";
import {
  INDIA_DIAL_CODE,
  formatIndianMobile,
  maskIndianMobile,
  normalizeIndianMobile,
  toE164India,
} from "@/lib/phone-number";

/**
 * Mobile Number OTP sign-in for Indian (+91) numbers.
 *
 * Flow (Firebase Phone Auth):
 *   1. customer types a 10-digit number            → `signInWithPhoneNumber`
 *   2. invisible reCAPTCHA runs in `#recaptcha-container` (no checkbox UI)
 *   3. Firebase sends the OTP to the SIM
 *   4. the 6-digit code is confirmed client-side   → `ConfirmationResult.confirm`
 *   5. the Firebase ID token is exchanged for the store's own signed session
 *      cookie at `/api/auth/phone` (verified server-side — never trusted here)
 *
 * Styling intentionally mirrors the existing Google sign-in card: light panel,
 * `#0f4c81` accent, 12px tracking-wide labels.
 */
export default function PhoneLogin({ next = "/dashboard" }: { next?: string }) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [seconds, setSeconds] = useState(0);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const verifyingRef = useRef(false);
  const autoSubmittedRef = useRef("");

  const mobile = normalizeIndianMobile(phone);

  /** Drop the current reCAPTCHA widget (it is single-use per challenge). */
  const resetRecaptcha = useCallback(() => {
    try {
      verifierRef.current?.clear();
    } catch {
      // Already torn down — nothing to do.
    }
    verifierRef.current = null;
  }, []);

  // Never leave a reCAPTCHA widget (or its iframe) behind on navigation.
  useEffect(() => resetRecaptcha, [resetRecaptcha]);

  // Resend countdown.
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setInterval(() => setSeconds((value) => (value > 0 ? value - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [seconds]);

  const ensureVerifier = useCallback(async (): Promise<RecaptchaVerifier> => {
    resetRecaptcha();
    const verifier = await createInvisibleRecaptcha("recaptcha-container");
    verifierRef.current = verifier;
    return verifier;
  }, [resetRecaptcha]);

  /** Step 1 — validate the number and ask Firebase to send an OTP. */
  const sendOtp = useCallback(
    async (resend = false) => {
      const target = normalizeIndianMobile(phone);
      if (!target) {
        setStep("phone");
        setError("Enter a valid 10-digit Indian mobile number (starting with 6, 7, 8 or 9).");
        return;
      }
      if (!FIREBASE_PHONE_AUTH_ENABLED) {
        setError(
          "Phone sign-in is not configured on this deployment yet. Add the NEXT_PUBLIC_FIREBASE_* variables and redeploy.",
        );
        return;
      }

      setBusy(true);
      setError("");
      setNotice("");
      try {
        const auth = await getFirebaseAuth();
        const { signInWithPhoneNumber } = await import("firebase/auth");
        const verifier = await ensureVerifier();
        const confirmation = await signInWithPhoneNumber(auth, toE164India(target), verifier);

        confirmationRef.current = confirmation;
        setStep("otp");
        setOtp("");
        autoSubmittedRef.current = "";
        setSeconds(45);
        setNotice(
          `${resend ? "A new OTP was sent" : "OTP sent"} to ${formatIndianMobile(target)}. It is valid for a few minutes.`,
        );
      } catch (thrown) {
        resetRecaptcha();
        setError(firebasePhoneAuthMessage(thrown));
      } finally {
        setBusy(false);
      }
    },
    [ensureVerifier, phone, resetRecaptcha],
  );

  /** Step 2 — confirm the OTP and exchange the ID token for a session. */
  const verifyOtp = useCallback(
    async (code: string = otp) => {
      const clean = code.replace(/\D/g, "").slice(0, 6);
      if (clean.length !== 6) {
        setError("Enter the 6-digit OTP we sent to your mobile number.");
        return;
      }
      if (!confirmationRef.current) {
        setStep("phone");
        setError("Your verification expired. Tap “Send OTP” again.");
        return;
      }
      if (verifyingRef.current) return;

      verifyingRef.current = true;
      setBusy(true);
      setError("");
      try {
        const credential = await confirmationRef.current.confirm(clean);
        const idToken = await credential.user.getIdToken(true);
        const response = await fetch("/api/auth/phone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({ idToken, next, name: name.trim() || undefined }),
        });
        const data = (await response.json().catch(() => null)) as { ok?: boolean; redirect?: string; error?: string } | null;

        if (!response.ok || !data?.ok) {
          setError(data?.error ?? "Could not create your session. Please try again.");
          return;
        }

        setNotice("Mobile number verified. Opening your dashboard…");
        // Hard navigation: guarantees the fresh httpOnly cookie is sent and
        // the proxy sees the new session immediately.
        window.location.assign(data.redirect || next || "/dashboard");
      } catch (thrown) {
        if (isOtpMismatch(thrown)) setOtp("");
        setError(firebasePhoneAuthMessage(thrown));
      } finally {
        verifyingRef.current = false;
        setBusy(false);
      }
    },
    [name, next, otp],
  );

  // Auto-verify once a full 6-digit code has been typed.
  useEffect(() => {
    if (step !== "otp" || busy) return;
    const clean = otp.replace(/\D/g, "");
    if (clean.length !== 6 || autoSubmittedRef.current === clean) return;
    autoSubmittedRef.current = clean;
    void verifyOtp(clean);
  }, [busy, otp, step, verifyOtp]);

  const changeNumber = () => {
    resetRecaptcha();
    confirmationRef.current = null;
    setStep("phone");
    setOtp("");
    setError("");
    setNotice("");
    setSeconds(0);
  };

  return (
    <div className="mt-6">
      {/* ── Step 1: mobile number ───────────────────────────────────── */}
      {step === "phone" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendOtp(false);
          }}
          className="grid gap-4"
        >
          <label className="grid gap-2 text-[10px] font-bold tracking-[.12em] text-[#334155]">
            MOBILE NUMBER
            <span className="flex items-stretch overflow-hidden rounded-xl border border-[#dbe2ec] bg-white focus-within:border-[#0f4c81] focus-within:ring-2 focus-within:ring-[#cfe3f7]">
              <span className="flex items-center gap-1.5 border-r border-[#e3e9f2] bg-[#f6f9fd] px-3 text-sm font-black text-[#0f4c81]">
                <FiSmartphone aria-hidden /> {INDIA_DIAL_CODE}
              </span>
              <input
                value={phone}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, "").slice(0, 10);
                  setPhone(digits);
                  if (error) setError("");
                }}
                inputMode="numeric"
                autoComplete="tel-national"
                type="tel"
                name="mobile"
                placeholder="98765 43210"
                className="h-12 w-full border-0 bg-transparent px-3 text-sm font-semibold tracking-wide text-[#0f172a] outline-none placeholder:font-normal placeholder:text-[#97a3b6]"
                aria-invalid={Boolean(error) || undefined}
              />
              {mobile ? <FiCheckCircle className="mr-3 self-center text-[#0e9f6e]" aria-hidden /> : null}
            </span>
          </label>

          <label className="grid gap-2 text-[10px] font-bold tracking-[.12em] text-[#334155]">
            YOUR NAME <span className="font-semibold tracking-normal text-[#94a3b8]">(OPTIONAL)</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value.slice(0, 60))}
              autoComplete="name"
              placeholder="Player name"
              className="form-input"
            />
          </label>

          <button
            type="submit"
            disabled={busy || !mobile}
            className="mt-1 flex w-full items-center justify-center gap-3 rounded-xl bg-[#0f4c81] px-5 py-4 text-xs font-black tracking-[.1em] text-white shadow-sm transition hover:bg-[#0a3557] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {busy ? <FiLoader className="animate-spin text-base" /> : <FiSmartphone className="text-base" />}
            {busy ? "SENDING OTP…" : "SEND OTP"}
          </button>
        </form>
      ) : (
        /* ── Step 2: OTP ───────────────────────────────────────────── */
        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-xl border border-[#dbe2ec] bg-[#f6f9fd] px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-[9px] font-bold tracking-[.16em] text-[#64748b]">OTP SENT TO</p>
              <p className="mt-1 truncate text-sm font-black tracking-wide text-[#0f172a]">
                {maskIndianMobile(phone) || phone}
              </p>
            </div>
            <button
              type="button"
              onClick={changeNumber}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#dbe2ec] bg-white px-3 py-2 text-[10px] font-bold tracking-[.08em] text-[#0f4c81] transition hover:border-[#0f4c81]"
            >
              <FiEdit2 /> CHANGE
            </button>
          </div>

          <label className="grid gap-2 text-[10px] font-bold tracking-[.12em] text-[#334155]">
            6-DIGIT OTP
            <input
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="••••••"
              aria-label="One time password"
              className="form-input text-center text-xl font-black tracking-[.55em]"
            />
          </label>

          <button
            type="button"
            onClick={() => void verifyOtp()}
            disabled={busy || otp.replace(/\D/g, "").length !== 6}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#0f4c81] px-5 py-4 text-xs font-black tracking-[.1em] text-white shadow-sm transition hover:bg-[#0a3557] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {busy ? <FiLoader className="animate-spin text-base" /> : <FiShield className="text-base" />}
            {busy ? "VERIFYING…" : "VERIFY & CONTINUE"}
          </button>

          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-[#64748b]">Didn’t get the code?</span>
            <button
              type="button"
              onClick={() => void sendOtp(true)}
              disabled={busy || seconds > 0}
              className="inline-flex items-center gap-1.5 font-bold tracking-[.06em] text-[#0f4c81] transition hover:text-[#0a3557] disabled:cursor-not-allowed disabled:text-[#94a3b8]"
            >
              <FiRefreshCw className={busy ? "animate-spin" : ""} />
              {seconds > 0 ? `RESEND IN ${seconds}s` : "RESEND OTP"}
            </button>
          </div>
        </div>
      )}

      {/* Feedback banners */}
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold leading-5 text-red-700"
        >
          {error}
        </p>
      ) : null}
      {notice && !error ? (
        <p
          aria-live="polite"
          className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold leading-5 text-emerald-700"
        >
          {notice}
        </p>
      ) : null}

      <p className="mt-5 flex items-start gap-2 text-[11px] leading-5 text-[#94a3b8]">
        <FiLock className="mt-0.5 shrink-0" />
        The OTP goes straight to your SIM through Firebase (Google). We never see or store your OTP, and we only keep your
        verified number for order updates.
      </p>

      {/* Invisible reCAPTCHA host — required by Firebase Phone Auth. */}
      <div id="recaptcha-container" />
    </div>
  );
}
