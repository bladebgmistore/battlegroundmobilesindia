"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiAlertCircle, FiArrowRight, FiLock, FiUser } from "react-icons/fi";
import { GridBackdrop, SiteHeader } from "@/components/site-chrome";
import { images } from "@/lib/store-data";

export type AuthMode = "login" | "signup" | "forgot" | "reset";

/**
 * Customer authentication page (login / signup / forgot-password).
 * Rendered inside a light premium card that matches the storefront theme.
 */
export default function UserAuthPage({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot-password two-step state.
  const [forgotStep, setForgotStep] = useState<"email" | "otp">("email");
  const [forgotOtp, setForgotOtp] = useState("");
  const [demoOtp, setDemoOtp] = useState("");

  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const heading =
    mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Set a new password";

  const sub =
    mode === "login"
      ? "Sign in to track your orders and checkout faster."
      : mode === "signup"
        ? "Create a free account to keep your orders and details saved."
        : mode === "forgot"
          ? "Enter your email and we'll send you a 6-digit verification code."
          : "Enter the code we sent you, then choose a new password.";

  const setToken = (data: { demoOtp?: string }) => {
    if (data.demoOtp) {
      setDemoOtp(data.demoOtp);
    }
  };

  const submitLogin = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Invalid credentials.");
        return;
      }
      router.replace("/account");
      router.refresh();
    } catch {
      setError("Unable to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitSignup = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (confirm && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: identifier.includes("@") ? identifier : undefined,
          whatsapp: identifier.includes("@") ? undefined : identifier,
          password,
        }),
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not create your account.");
        return;
      }
      router.replace("/account");
      router.refresh();
    } catch {
      setError("Unable to create your account. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitForgotEmail = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not send a reset code.");
        setBusy(false);
        return;
      }
      setToken(data);
      setInfo("A 6-digit code has been sent to your email.");
      setForgotStep("otp");
    } catch {
      setError("Unable to send a reset code. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, otp: forgotOtp || demoOtp, newPassword: password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Invalid or expired code.");
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Unable to reset your password. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const fieldLabel = mode === "signup" ? "EMAIL ADDRESS OR WHATSAPP NUMBER" : "EMAIL OR WHATSAPP NUMBER";

  return (
    <>
      <GridBackdrop />
      <SiteHeader />
      <main className="relative flex min-h-[70vh] items-center justify-center px-5 py-16">
        <section className="premium-card w-full max-w-md p-7 sm:p-9">
          <div className="mx-auto grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border border-[#e3e9f2] bg-white">
            <img src={images.logo} alt="Battleground Mobile India Store" className="h-full w-full object-cover" />
          </div>
          <div className="mt-6 text-center">
            <p className="text-[10px] font-black tracking-[.18em] text-[#0f4c81]">CUSTOMER ACCOUNT</p>
            <h1 className="mt-3 text-3xl font-black tracking-[-.05em] text-[#0f172a]">{heading}</h1>
            <p className="mt-3 text-sm leading-6 text-[#64748b]">{sub}</p>
          </div>

          {mode === "signup" && (
            <form onSubmit={submitSignup} className="mt-8 grid gap-4">
              <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-[#334155]">
                YOUR NAME
                <input value={name} onChange={(e) => setName(e.target.value)} required className="form-input" placeholder="e.g. Rahul Sharma" />
              </label>
              <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-[#334155]">
                {fieldLabel}
                <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="name@example.com or +91 98XXXXXX" className="form-input" />
              </label>
              <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-[#334155]">
                PASSWORD
                <div className="relative">
                  <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} minLength={6} required className="form-input pr-10" placeholder="Min. 6 characters" />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#0f4c81]">{showPassword ? "HIDE" : "SHOW"}</button>
                </div>
              </label>
              <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-[#334155]">
                CONFIRM PASSWORD
                <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type={showPassword ? "text" : "password"} required className="form-input" placeholder="Re-enter password" />
              </label>

              {error && <p className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-xs font-bold text-[#c62828]"><FiAlertCircle />{error}</p>}

              <button disabled={busy} className="btn-primary flex items-center justify-center gap-2 py-3.5 text-xs font-black tracking-[.12em] disabled:opacity-50">
                <FiUser />{busy ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}
              </button>
            </form>
          )}

          {mode === "login" && (
            <form onSubmit={submitLogin} className="mt-8 grid gap-4">
              <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-[#334155]">
                {fieldLabel}
                <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required className="form-input" placeholder="name@example.com or +91 98XXXXXX" />
              </label>
              <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-[#334155]">
                PASSWORD
                <div className="relative">
                  <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} required className="form-input pr-10" placeholder="Your password" />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#0f4c81]">{showPassword ? "HIDE" : "SHOW"}</button>
                </div>
              </label>

              {error && <p className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-xs font-bold text-[#c62828]"><FiAlertCircle />{error}</p>}

              <button disabled={busy} className="btn-primary flex items-center justify-center gap-2 py-3.5 text-xs font-black tracking-[.12em] disabled:opacity-50">
                <FiLock />{busy ? "SIGNING IN..." : "SIGN IN"}
              </button>

              <Link href="/forgot-password" className="text-center text-xs font-bold text-[#0f4c81] hover:underline">Forgot your password?</Link>
            </form>
          )}

          {mode === "forgot" && forgotStep === "email" && (
            <form onSubmit={submitForgotEmail} className="mt-8 grid gap-4">
              <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-[#334155]">
                EMAIL ADDRESS
                <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} type="email" required className="form-input" placeholder="name@example.com" />
              </label>
              {error && <p className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-xs font-bold text-[#c62828]"><FiAlertCircle />{error}</p>}
              <button disabled={busy} className="btn-primary flex items-center justify-center gap-2 py-3.5 text-xs font-black tracking-[.12em] disabled:opacity-50">
                <FiArrowRight />{busy ? "SENDING..." : "SEND CODE"}
              </button>
            </form>
          )}

          {mode === "forgot" && forgotStep === "otp" && (
            <form onSubmit={submitReset} className="mt-8 grid gap-4">
              {info && <p className="rounded-lg bg-[#e0eefb] p-3 text-xs font-bold text-[#0f4c81]">{info}</p>}
              {demoOtp && <p className="rounded-lg bg-[#fdf1d1] p-3 text-xs font-bold text-[#8a6d00]">{`Demo code: ${demoOtp}`}</p>}
              <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-[#334155]">
                6-DIGIT CODE
                <input value={forgotOtp} onChange={(e) => setForgotOtp(e.target.value)} maxLength={6} className="form-input tracking-[.4em]" placeholder="••••••" />
              </label>
              <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-[#334155]">
                NEW PASSWORD
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} className="form-input" placeholder="Min. 6 characters" />
              </label>
              <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-[#334155]">
                CONFIRM NEW PASSWORD
                <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" required className="form-input" placeholder="Re-enter password" />
              </label>
              {error && <p className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-xs font-bold text-[#c62828]"><FiAlertCircle />{error}</p>}
              <button disabled={busy} className="btn-primary flex items-center justify-center gap-2 py-3.5 text-xs font-black tracking-[.12em] disabled:opacity-50">
                <FiLock />{busy ? "UPDATING..." : "RESET PASSWORD"}
              </button>
            </form>
          )}

          <div className="mt-7 border-t border-[#e5e8ef] pt-5 text-center text-sm">
            {mode === "login" ? (
              <span className="text-[#64748b]">New here?{" "}<Link href="/signup" className="font-bold text-[#0f4c81] hover:underline">Create an account</Link></span>
            ) : mode === "signup" ? (
              <span className="text-[#64748b]">Already have an account?{" "}<Link href="/login" className="font-bold text-[#0f4c81] hover:underline">Sign in</Link></span>
            ) : (
              <Link href="/login" className="font-bold text-[#0f4c81] hover:underline">Back to sign in</Link>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
