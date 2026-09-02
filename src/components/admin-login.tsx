"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { FiAlertCircle, FiLock, FiShield } from "react-icons/fi";
import { GridBackdrop } from "@/components/site-chrome";
import { images } from "@/lib/store-data";

type LoginValues = { username: string; password: string };

export default function AdminLogin() {
  const [error, setError] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<LoginValues>();

  // No client session check — proxy handles signed-in users.
  const login = async (values: LoginValues) => {
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
        credentials: "same-origin",
      });
      if (res.ok) {
        setRedirecting(true);
        window.location.href = "/admin/dashboard";
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Invalid username or password.");
    } catch {
      setError("Unable to sign in. Please try again.");
    }
  };

  const busy = isSubmitting || redirecting;

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 py-10">
      <GridBackdrop />
      <section className="relative w-full max-w-md rounded-2xl border border-white/[.12] bg-[#111511]/90 p-7 shadow-2xl backdrop-blur-xl sm:p-9">
        <div className="mx-auto grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border border-[#d7f454]/35 bg-[#d7f454]/10">
          <img src={images.logo} alt="Battleground Mobile India Store" className="h-full w-full object-cover" />
        </div>
        <div className="mt-6 text-center">
          <p className="text-[10px] font-black tracking-[.18em] text-[#d9f558]">RESTRICTED ACCESS</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-.05em] text-white">Control Centre</h1>
          <p className="mt-3 text-sm leading-6 text-white/50">Sign in to manage the store.</p>
        </div>
        <form onSubmit={handleSubmit(login)} className="mt-8 grid gap-5">
          <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-white/45">USERNAME
            <input {...register("username", { required: true })} autoComplete="username" className="form-input" placeholder="Enter username" />
          </label>
          <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-white/45">PASSWORD
            <input {...register("password", { required: true })} type="password" autoComplete="current-password" className="form-input" placeholder="Enter password" />
          </label>
          {error && (
            <p className="flex items-center gap-2 rounded-lg bg-red-400/10 p-3 text-xs font-bold text-red-200">
              <FiAlertCircle />{error}
            </p>
          )}
          <button disabled={busy} className="flex items-center justify-center gap-2 rounded-xl bg-[#ccf138] py-4 text-xs font-black tracking-[.12em] text-[#0c1007] disabled:opacity-50">
            <FiLock />{busy ? "AUTHENTICATING..." : "SECURE SIGN IN"}
          </button>
        </form>
        <div className="mt-6 flex items-center justify-center gap-2 text-[10px] font-bold tracking-[.08em] text-white/35">
          <FiShield className="text-[#d9f558]" /> SESSION PROTECTED · 12 HOUR EXPIRY
        </div>
      </section>
    </main>
  );
}
