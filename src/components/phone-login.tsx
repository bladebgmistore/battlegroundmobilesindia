"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiEdit2,
  FiLoader,
  FiLock,
  FiRefreshCw,
  FiShield,
  FiSmartphone,
  FiUser,
} from "react-icons/fi";
import type { ConfirmationResult, RecaptchaVerifier } from "firebase/auth";
import { FIREBASE_PHONE_AUTH_ENABLED, getFirebaseAuth } from "@/lib/firebase";
import { firebasePhoneAuthMessage, isOtpMismatch } from "@/lib/firebase-errors";
import {
  INDIA_DIAL_CODE,
  formatIndianMobile,
  formatStrictIndianPhone,
  maskIndianMobile,
  normalizeIndianMobile,
} from "@/lib/phone-number";

interface PhoneLoginProps {
  next?: string;
  mode?: "login" | "signup";
}

/**
 * Mobile Number OTP sign-in/up for Indian (+91) numbers.
 *
 * Flow (Firebase Phone Auth):
 *   1. Customer enters 10-digit number -> strictly formatted as +91XXXXXXXXXX.
 *   2. Invisible reCAPTCHA container initialized & cleaned up inside useEffect.
 *   3. Firebase sends OTP -> ConfirmationResult.
 *   4. Customer enters 6-digit OTP -> confirmation.confirm(code).
 *   5. ID token exchanged for store session cookie at /api/auth/phone.
 *   6. Detailed error.message displayed on UI for easy debugging.
 */
export default function PhoneLogin({ next = "/dashboard", mode = "login" }: PhoneLoginProps) {
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

  const localDigits = normalizeIndianMobile(phone);

  // Initialize and clean up RecaptchaVerifier inside useEffect
  useEffect(() => {
    let isMounted = true;

    async function initRecaptcha() {
      try {
        const container = document.getElementById("recaptcha-container");
        if (!container || !isMounted) return;

        // Clear previous verifier instance if any
        if (verifierRef.current) {
          try {
            verifierRef.current.clear();
          } catch {
            // ignore
          }
          verifierRef.current = null;
        }

        const auth = await getFirebaseAuth();
        const { RecaptchaVerifier } = await import("firebase/auth");

        const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
          callback: () => {
            // reCAPTCHA solved
          },
          "expired-callback": () => {
            setError("reCAPTCHA check expired. Please tap 'Send OTP' again.");
          },
        });

        if (isMounted) {
          verifierRef.current = verifier;
        } else {
          verifier.clear();
        }
      } catch (err: unknown) {
        console.error("Recaptcha initialization failed:", err);
      }
    }

    void initRecaptcha();

    return () => {
      isMounted = false;
      if (verifierRef.current) {
        try {
          verifierRef.current.clear();
        } catch {
          // ignore
        }
        verifierRef.current = null;
      }
    };
  }, []);

  // Countdown timer for Resend OTP
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setInterval(() => {
      setSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [seconds]);

  // Helper to ensure an active RecaptchaVerifier exists
  const getOrInitVerifier = useCallback(async (): Promise<RecaptchaVerifier> => {
    if (verifierRef.current) {
      return verifierRef.current;
    }
    const auth = await getFirebaseAuth();
    const { RecaptchaVerifier } = await import("firebase/auth");
    const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
      callback: () => {},
      "expired-callback": () => {
        setError("reCAPTCHA check expired. Please try again.");
      },
    });
    verifierRef.current = verifier;
    return verifier;
  }, []);

  /** Step 1: Send OTP to the strictly formatted +91 number */
  const sendOtp = useCallback(
    async (resend = false) => {
      // 1. Strict formatting with +91 prefix
      const formattedPhone = formatStrictIndianPhone(phone);
      if (!formattedPhone) {
        setStep("phone");
        setError("Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9.");
        return;
      }

      if (!FIREBASE_PHONE_AUTH_ENABLED) {
        setError("Firebase phone authentication is not configured yet. Check NEXT_PUBLIC_FIREBASE_* variables.");
        return;
      }

      setBusy(true);
      setError("");
      setNotice("");

      try {
        const auth = await getFirebaseAuth();
        const { signInWithPhoneNumber } = await import("firebase/auth");
        const verifier = await getOrInitVerifier();

        // Pass strictly formatted +91XXXXXXXXXX phone number
        const confirmation = await signInWithPhoneNumber(auth, formattedPhone, verifier);

        confirmationRef.current = confirmation;
        setStep("otp");
        setOtp("");
        autoSubmittedRef.current = "";
        setSeconds(45);
        setNotice(
          `${resend ? "A new OTP was sent" : "OTP sent"} to ${formatIndianMobile(formattedPhone)}. It is valid for a few minutes.`,
        );
      } catch (thrown: unknown) {
        // Reset verifier so subsequent attempts don't use a stale widget
        if (verifierRef.current) {
          try {
            verifierRef.current.clear();
          } catch {
            // ignore
          }
          verifierRef.current = null;
        }

        // Display exact error.message for easy debugging
        const rawMessage =
          thrown instanceof Error
            ? thrown.message
            : typeof thrown === "object" && thrown !== null && "message" in thrown
            ? String((thrown as { message?: unknown }).message)
            : String(thrown);

        const errorCode =
          typeof thrown === "object" && thrown !== null && "code" in thrown
            ? String((thrown as { code?: unknown }).code)
            : "";

        const friendlyMsg = firebasePhoneAuthMessage(thrown);
        const display = rawMessage
          ? friendlyMsg.includes(rawMessage)
            ? friendlyMsg
            : `${friendlyMsg} (${rawMessage})`
          : friendlyMsg || `Authentication error: ${errorCode || "Unknown"}`;

        setError(display);
      } finally {
        setBusy(false);
      }
    },
    [getOrInitVerifier, phone],
  );

  /** Step 2: Confirm OTP & exchange ID token for session */
  const verifyOtp = useCallback(
    async (code: string = otp) => {
      const clean = code.replace(/\D/g, "").slice(0, 6);
      if (clean.length !== 6) {
        setError("Enter the complete 6-digit OTP sent to your mobile number.");
        return;
      }
      if (!confirmationRef.current) {
        setStep("phone");
        setError("Your verification expired. Please request a new OTP.");
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
        const data = (await response.json().catch(() => null)) as {
          ok?: boolean;
          redirect?: string;
          error?: string;
        } | null;

        if (!response.ok || !data?.ok) {
          setError(data?.error ?? "Could not create your session. Please try again.");
          return;
        }

        setNotice("Mobile verified! Redirecting you now…");
        window.location.assign(data.redirect || next || "/dashboard");
      } catch (thrown: unknown) {
        if (isOtpMismatch(thrown)) setOtp("");

        const rawMessage =
          thrown instanceof Error
            ? thrown.message
            : typeof thrown === "object" && thrown !== null && "message" in thrown
            ? String((thrown as { message?: unknown }).message)
            : String(thrown);

        const friendlyMsg = firebasePhoneAuthMessage(thrown);
        const display = rawMessage
          ? friendlyMsg.includes(rawMessage)
            ? friendlyMsg
            : `${friendlyMsg} (${rawMessage})`
          : friendlyMsg;

        setError(display);
      } finally {
        verifyingRef.current = false;
        setBusy(false);
      }
    },
    [name, next, otp],
  );

  // Auto-verify when 6 digits are typed
  useEffect(() => {
    if (step !== "otp" || busy) return;
    const clean = otp.replace(/\D/g, "");
    if (clean.length !== 6 || autoSubmittedRef.current === clean) return;
    autoSubmittedRef.current = clean;
    void verifyOtp(clean);
  }, [busy, otp, step, verifyOtp]);

  const changeNumber = () => {
    if (verifierRef.current) {
      try {
        verifierRef.current.clear();
      } catch {
        // ignore
      }
      verifierRef.current = null;
    }
    confirmationRef.current = null;
    setStep("phone");
    setOtp("");
    setError("");
    setNotice("");
    setSeconds(0);
  };

  return (
    <div className="w-full">
      {/* ── Step 1: Phone input ─────────────────────────────────────── */}
      {step === "phone" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendOtp(false);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-[11px] font-black tracking-wider text-slate-300 uppercase mb-2">
              Indian Mobile Number (+91)
            </label>
            <div className="flex items-center overflow-hidden rounded-xl border border-slate-700 bg-[#0b1220] focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all">
              <span className="flex items-center gap-1.5 border-r border-slate-700/80 bg-slate-800/60 px-3.5 py-3 text-sm font-bold text-cyan-400 select-none">
                <FiSmartphone className="text-base" /> {INDIA_DIAL_CODE}
              </span>
              <input
                value={phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setPhone(digits);
                  if (error) setError("");
                }}
                inputMode="numeric"
                autoComplete="tel-national"
                type="tel"
                name="mobile"
                placeholder="98765 43210"
                className="h-12 w-full bg-transparent px-3.5 text-sm font-bold tracking-wider text-white placeholder:text-slate-500 outline-none"
                aria-invalid={Boolean(error) || undefined}
              />
              {localDigits ? (
                <FiCheckCircle className="mr-3 text-emerald-400 text-lg shrink-0" aria-label="Valid format" />
              ) : null}
            </div>
            <p className="mt-1.5 text-[10px] text-slate-400">
              Enter your 10-digit number. Firebase will send a secure verification code via SMS.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-black tracking-wider text-slate-300 uppercase mb-2">
              Player Name {mode === "login" && <span className="font-normal text-slate-500 lowercase">(optional)</span>}
            </label>
            <div className="flex items-center overflow-hidden rounded-xl border border-slate-700 bg-[#0b1220] focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all">
              <span className="flex items-center border-r border-slate-700/80 bg-slate-800/60 px-3.5 py-3 text-sm text-slate-400">
                <FiUser />
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 60))}
                autoComplete="name"
                placeholder={mode === "signup" ? "Your BGMI username / in-game name" : "Player name"}
                className="h-12 w-full bg-transparent px-3.5 text-sm font-semibold text-white placeholder:text-slate-500 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy || !localDigits}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#0f4c81] to-[#1e6fbe] hover:from-[#0d3f6c] hover:to-[#175b9c] px-5 py-3.5 text-xs font-black tracking-wider text-white shadow-[0_4px_20px_rgba(15,76,129,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {busy ? <FiLoader className="animate-spin text-base" /> : <FiSmartphone className="text-base" />}
            {busy ? "SENDING OTP VIA FIREBASE…" : "SEND OTP TO PHONE"}
          </button>
        </form>
      ) : (
        /* ── Step 2: OTP verification ───────────────────────────────── */
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-[#0b1220] px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">OTP SENT TO</p>
              <p className="mt-0.5 truncate text-sm font-black tracking-wider text-cyan-400">
                {maskIndianMobile(phone) || `+91 ${phone}`}
              </p>
            </div>
            <button
              type="button"
              onClick={changeNumber}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white hover:border-slate-600 transition"
            >
              <FiEdit2 /> Change
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-black tracking-wider text-slate-300 uppercase mb-2 text-center">
              Enter 6-Digit Verification Code
            </label>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="••••••"
              aria-label="6-digit verification code"
              className="h-14 w-full rounded-xl border border-slate-700 bg-[#0b1220] text-center text-2xl font-black tracking-[.6em] text-cyan-300 placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-none transition"
            />
          </div>

          <button
            type="button"
            onClick={() => void verifyOtp()}
            disabled={busy || otp.replace(/\D/g, "").length !== 6}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#0f4c81] to-[#1e6fbe] hover:from-[#0d3f6c] hover:to-[#175b9c] px-5 py-3.5 text-xs font-black tracking-wider text-white shadow-[0_4px_20px_rgba(15,76,129,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {busy ? <FiLoader className="animate-spin text-base" /> : <FiShield className="text-base" />}
            {busy ? "VERIFYING CODE…" : "VERIFY OTP & CONTINUE"}
          </button>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-400">Didn’t receive the code?</span>
            <button
              type="button"
              onClick={() => void sendOtp(true)}
              disabled={busy || seconds > 0}
              className="inline-flex items-center gap-1.5 font-bold text-cyan-400 hover:text-cyan-300 disabled:text-slate-500 disabled:cursor-not-allowed transition"
            >
              <FiRefreshCw className={busy ? "animate-spin" : ""} />
              {seconds > 0 ? `Resend in ${seconds}s` : "Resend OTP"}
            </button>
          </div>
        </div>
      )}

      {/* Error Banner with exact error.message displayed */}
      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-500/40 bg-red-950/70 p-3.5 text-xs text-red-200"
        >
          <div className="flex items-start gap-2.5">
            <FiAlertTriangle className="mt-0.5 text-base shrink-0 text-red-400" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-red-300 uppercase tracking-wider text-[10px]">Authentication Error</p>
              <p className="mt-1 break-words font-mono text-[11px] leading-relaxed text-red-200">{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Notice Banner */}
      {notice && !error ? (
        <div
          aria-live="polite"
          className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-950/70 p-3.5 text-xs text-emerald-200"
        >
          <div className="flex items-start gap-2.5">
            <FiCheckCircle className="mt-0.5 text-base shrink-0 text-emerald-400" />
            <p className="leading-relaxed font-medium">{notice}</p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/80 pt-3">
        <FiLock className="mt-0.5 shrink-0 text-cyan-400" />
        <span>
          SMS OTP is routed securely through Google Firebase. Your phone number is verified instantly and used for
          order tracking.
        </span>
      </div>

      {/* Invisible reCAPTCHA container required by Firebase Phone Auth */}
      <div id="recaptcha-container" />
    </div>
  );
}
