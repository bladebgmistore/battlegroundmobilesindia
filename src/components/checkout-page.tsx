"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { FaWhatsapp } from "react-icons/fa";
import { FiAlertTriangle, FiArrowLeft, FiCheckCircle, FiGift, FiLock, FiUser, FiCreditCard, FiLoader, FiShield } from "react-icons/fi";
import { formatINR } from "@/lib/store-data";
import { GridBackdrop, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { useStoreSettings } from "@/lib/use-store-settings";

type CheckoutForm = { name: string; whatsapp: string; playerUid: string };
type CouponResult = { code: string; discountAmount: number; finalAmount: number; valid: boolean };
type UidStatus = "idle" | "checking" | "verified" | "soft-pass" | "error";

export default function CheckoutPage() {
  const params = useSearchParams();
  const router = useRouter();
  const product = params.get("product") ?? "Selected product";
  const baseAmount = Number(params.get("amount") ?? 0);
  const [busy, setBusy] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [couponResult, setCouponResult] = useState<CouponResult | null>(null);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<CheckoutForm>();
  const { whatsappWithText, whatsappNumber, checkoutMode } = useStoreSettings();

  const payableAmount = couponResult?.finalAmount ?? baseAmount;
  const discountAmount = couponResult?.discountAmount ?? 0;
  // UID verification is enabled ONLY for UC, SUPER-CARS and X-SUIT categories.
  // Those category pages append uid=1 to the Buy Now URL; account deals never do.
  const needsUid = params.get("uid") === "1";

  // ── BGMI UID auto-verification state ─────────────────────────────
  const [uidStatus, setUidStatus] = useState<UidStatus>("idle");
  const [playerName, setPlayerName] = useState("");
  const [uidMessage, setUidMessage] = useState("");
  const uidValue = watch("playerUid") ?? "";
  const verifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastVerifiedUid = useRef("");

  const verifyUid = async (uid: string) => {
    if (!/^\d{8,12}$/.test(uid)) {
      setUidStatus("error");
      setPlayerName("");
      setUidMessage("Enter a valid BGMI UID (8-12 digits).");
      return;
    }
    if (uid === lastVerifiedUid.current && (uidStatus === "verified" || uidStatus === "soft-pass")) return;
    setUidStatus("checking");
    setPlayerName("");
    setUidMessage("");
    try {
      const response = await fetch(`/api/bgmi/verify-uid?uid=${encodeURIComponent(uid)}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (data?.verified && data.playerName) {
        lastVerifiedUid.current = uid;
        setUidStatus("verified");
        setPlayerName(String(data.playerName));
        setUidMessage("");
      } else if (response.ok && data && !data.verified && /busy|continue/i.test(String(data.error ?? ""))) {
        // Lookup service unreachable — UID format valid, allow checkout.
        lastVerifiedUid.current = uid;
        setUidStatus("soft-pass");
        setUidMessage(String(data.error));
      } else {
        setUidStatus("error");
        setUidMessage(String(data?.error ?? "Could not verify this UID. Please re-check it."));
      }
    } catch {
      lastVerifiedUid.current = uid;
      setUidStatus("soft-pass");
      setUidMessage("Verification service unreachable — your UID format looks valid, you can continue.");
    }
  };

  // Debounced auto-fetch: verify automatically once a complete UID is typed.
  useEffect(() => {
    if (!needsUid) return;
    const uid = uidValue.trim();
    if (verifyTimer.current) clearTimeout(verifyTimer.current);
    if (!uid) {
      setUidStatus("idle");
      setPlayerName("");
      setUidMessage("");
      return;
    }
    if (!/^\d{8,12}$/.test(uid)) {
      setUidStatus("idle");
      setPlayerName("");
      return;
    }
    verifyTimer.current = setTimeout(() => void verifyUid(uid), 600);
    return () => {
      if (verifyTimer.current) clearTimeout(verifyTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uidValue, needsUid]);

  const applyCoupon = async () => {

    if (!coupon.trim() || !baseAmount) return;
    setCouponBusy(true);
    setCouponError("");
    try {
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: coupon, amount: baseAmount }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.valid) {
        setCouponResult(null);
        setCouponError(data?.error ?? "Coupon could not be applied.");
        return;
      }
      setCouponResult(data);
    } finally {
      setCouponBusy(false);
    }
  };

  const submit = async (values: CheckoutForm) => {
    if (needsUid && !values.playerUid?.trim()) {
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: values.name,
          customerWhatsapp: values.whatsapp,
          playerUid: values.playerUid?.trim() || null,
          playerName: playerName || null,
          productName: product,
          baseAmount,
          couponCode: couponResult?.code ?? null,
        }),
      });
      const data = await response.json().catch(() => null);
      const finalAmount = data?.finalAmount ?? payableAmount;
      const orderCode = data?.orderCode ?? `BG-${Date.now().toString(36).toUpperCase()}`;
      const uid = values.playerUid?.trim() || "";

      if (checkoutMode === "qr") {
        // Go to premium QR payment page
        const qs = new URLSearchParams({
          orderCode,
          product,
          amount: String(finalAmount),
          baseAmount: String(baseAmount),
          ...(couponResult?.code ? { coupon: couponResult.code, discount: String(discountAmount) } : {}),
          ...(uid ? { uid } : {}),
          ...(playerName ? { ign: playerName } : {}),
          name: values.name,
          whatsapp: values.whatsapp,
        }).toString();
        router.push(`/payment?${qs}`);
      } else {
        // WhatsApp flow
        let message = `Hello, I want to purchase: ${product}. Original price: ${formatINR(baseAmount)}.`;
        if (uid) message += ` Player UID: ${uid}.`;
        if (playerName) message += ` Player Name: ${playerName}.`;
        if (discountAmount) message += ` Discount: ${formatINR(discountAmount)} with coupon ${couponResult?.code}.`;

        message += ` Final amount: ${formatINR(finalAmount)}. Order reference: ${orderCode}. Name: ${values.name}, WhatsApp: ${values.whatsapp}`;
        window.open(whatsappWithText(message), "_blank", "noopener,noreferrer");
      }
    } finally {
      setBusy(false);
    }
  };

  const isQrMode = checkoutMode === "qr";

  return (
    <>
      <GridBackdrop />
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-14 lg:px-8 lg:py-20">
        <Link href="/accounts" className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[.12em] text-[#64748b] hover:text-[#0f172a]"><FiArrowLeft /> BACK TO STORE</Link>
        <div className="mt-7 grid gap-5 lg:grid-cols-[.88fr_1.12fr]">
          <aside className="premium-card p-6">
            <p className="text-[10px] font-bold tracking-[.17em] text-[#0f4c81]">YOUR SELECTION</p>
            <h1 className="mt-4 text-2xl font-black leading-7 tracking-[-.04em] text-[#0f172a]">{product}</h1>
            <div className="mt-7 space-y-3 border-y border-[#e5e8ef] py-5 text-sm">
              <div className="flex items-center justify-between"><span className="text-[#64748b]">Listed price</span><strong className="text-[#0f172a]">{baseAmount ? formatINR(baseAmount) : "On request"}</strong></div>
              <div className="flex items-center justify-between"><span className="text-[#64748b]">Coupon discount</span><strong className="text-[#0e9f6e]">{discountAmount ? `- ${formatINR(discountAmount)}` : "—"}</strong></div>
              <div className="flex items-center justify-between text-base"><span className="text-[#64748b]">Final amount</span><strong className="text-xl text-[#0f172a]">{baseAmount ? formatINR(payableAmount) : "On request"}</strong></div>
              {needsUid && <p className="pt-2 text-[10px] font-bold tracking-wide text-[#0f4c81]">* Player UID required for this product</p>}
            </div>
            <div className="mt-6 space-y-3 text-xs text-[#64748b]">
              <p className="flex gap-2"><FiCheckCircle className="shrink-0 text-[#0e9f6e]" /> Official WhatsApp follow-up</p>
              <p className="flex gap-2"><FiCheckCircle className="shrink-0 text-[#0e9f6e]" /> {isQrMode ? "Secure UPI QR Payment" : "Guided completion steps"}</p>
              <p className="flex gap-2"><FiLock className="shrink-0 text-[#0e9f6e]" /> Never share OTP or recovery codes</p>
              <p className="flex gap-2"><FaWhatsapp className="shrink-0 text-[#0e9f6e]" /> Official support: +91 {whatsappNumber}</p>
            </div>
            {isQrMode && (
              <div className="mt-6 rounded-xl border border-[#d9e4f0] bg-[#f3f8fe] p-4">
                <p className="flex items-center gap-2 text-xs font-bold text-[#0f4c81]"><FiCreditCard /> UPI QR PAYMENT ENABLED</p>
                <p className="mt-2 text-xs leading-5 text-[#64748b]">After filling details, you&apos;ll get an instant UPI QR code for {formatINR(payableAmount)}. Scan & pay securely.</p>
              </div>
            )}
          </aside>

          <section className="premium-card p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl ${isQrMode ? "bg-[#e0eefb] text-[#0f4c81]" : "bg-[#fdf1d1] text-[#b07d00]"}`}>{isQrMode ? <FiCreditCard /> : <FiAlertTriangle />}</div>
              <div>
                <p className={`text-[10px] font-bold tracking-[.16em] ${isQrMode ? "text-[#0f4c81]" : "text-[#b07d00]"}`}>{isQrMode ? "SECURE CHECKOUT" : "GATEWAY NOTICE"}</p>
                <h2 className="mt-2 text-2xl font-black leading-7 text-[#0f172a]">{isQrMode ? `Pay ${formatINR(payableAmount)} via UPI QR` : "Payment system is currently under maintenance."}</h2>
                <p className="mt-3 text-sm leading-6 text-[#64748b]">{isQrMode ? `Your order will be placed instantly and a UPI QR code will be generated for ${product}. Complete payment to confirm.` : "Please contact our official admin to complete your purchase. We'll confirm the next step and delivery flow directly on WhatsApp."}</p>
              </div>
            </div>

            <div className="mt-7 rounded-xl border border-[#e5e8ef] bg-[#f8fafc] p-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="grow">
                  <label className="mb-2 block text-[10px] font-bold tracking-[.12em] text-[#64748b]">APPLY COUPON</label>
                  <input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Enter coupon code" className="form-input" />
                </div>
                <button type="button" onClick={applyCoupon} disabled={couponBusy || !coupon.trim()} className="btn-outline self-end !py-3"><span className="inline-flex items-center gap-2"><FiGift /> {couponBusy ? "APPLYING..." : "APPLY"}</span></button>
              </div>
              {couponError && <p className="mt-3 text-xs font-bold text-red-600">{couponError}</p>}
              {couponResult && <p className="mt-3 text-xs font-bold text-[#0e9f6e]">Coupon <span className="font-black">{couponResult.code}</span> applied successfully.</p>}
            </div>

            <form onSubmit={handleSubmit(submit)} className="mt-8 border-t border-[#e5e8ef] pt-6">
              <p className="text-xs font-bold text-[#334155]">Enter your details to generate {isQrMode ? "QR & place order" : "support reference"}.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-[10px] font-bold tracking-[.1em] text-[#334155]">YOUR NAME
                  <input {...register("name", { required: "Name is required" })} placeholder="Player name" className="form-input" />
                  {errors.name && <span className="text-[10px] normal-case tracking-normal text-red-600">{errors.name.message}</span>}
                </label>
                <label className="grid gap-2 text-[10px] font-bold tracking-[.1em] text-[#334155]">WHATSAPP NUMBER
                  <input {...register("whatsapp", { required: "WhatsApp number is required", minLength: { value: 10, message: "Enter a valid number" } })} inputMode="numeric" placeholder="10-digit number" className="form-input" />
                  {errors.whatsapp && <span className="text-[10px] normal-case tracking-normal text-red-600">{errors.whatsapp.message}</span>}
                </label>
              </div>
              {needsUid && (
                <div className="fade-in mt-3">
                  <label className="grid gap-2 text-[10px] font-bold tracking-[.1em] text-[#334155]">
                    <span>BGMI UID (CHARACTER ID) <span className="text-[#0f4c81]">*REQUIRED</span></span>
                    <div className="relative">
                      <input
                        {...register("playerUid", {
                          required: needsUid ? "BGMI UID is required for UC / Super Cars / X-Suit" : false,
                          pattern: { value: /^\d{8,12}$/, message: "UID must be 8-12 digits" },
                        })}
                        inputMode="numeric"
                        placeholder="Enter your BGMI UID (e.g. 5123456789)"
                        className={`form-input pr-11 ${uidStatus === "verified" ? "!border-[#0e9f6e]" : uidStatus === "error" ? "!border-red-400" : ""}`}
                        autoComplete="off"
                      />
                      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-lg">
                        {uidStatus === "checking" && <FiLoader className="animate-spin text-[#0f4c81]" />}
                        {uidStatus === "verified" && <FiCheckCircle className="text-[#0e9f6e]" />}
                        {uidStatus === "soft-pass" && <FiShield className="text-[#f4b400]" />}
                        {uidStatus === "error" && <FiAlertTriangle className="text-red-500" />}
                      </span>
                    </div>
                    {errors.playerUid && <span className="text-[10px] normal-case tracking-normal text-red-600">{errors.playerUid.message}</span>}
                  </label>

                  {/* Live verification states */}
                  {uidStatus === "checking" && (
                    <div className="fade-in mt-2 flex items-center gap-2 rounded-lg border border-[#dbe2ec] bg-[#f3f8fe] px-3.5 py-2.5 text-xs font-bold text-[#0f4c81]">
                      <FiLoader className="animate-spin" /> Verifying UID & fetching player name…
                    </div>
                  )}
                  {uidStatus === "verified" && playerName && (
                    <div className="fade-in mt-2 flex items-center gap-2.5 rounded-lg border border-[#bbe7d4] bg-[#effaf5] px-3.5 py-2.5">
                      <FiUser className="shrink-0 text-lg text-[#0e9f6e]" />
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold tracking-[.14em] text-[#0e9f6e]">PLAYER VERIFIED — IN-GAME NAME</p>
                        <p className="truncate text-sm font-black text-[#0f172a]">{playerName}</p>
                      </div>
                      <FiCheckCircle className="ml-auto shrink-0 text-lg text-[#0e9f6e]" />
                    </div>
                  )}
                  {uidStatus === "soft-pass" && uidMessage && (
                    <p className="fade-in mt-2 rounded-lg border border-[#f2e2b3] bg-[#fdf9ec] px-3.5 py-2.5 text-[11px] font-semibold normal-case leading-4 tracking-normal text-[#8a6d1a]">{uidMessage}</p>
                  )}
                  {uidStatus === "error" && uidMessage && (
                    <p className="fade-in mt-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[11px] font-semibold normal-case leading-4 tracking-normal text-red-600">{uidMessage}</p>
                  )}
                  <span className="mt-2 block text-[10px] font-medium normal-case tracking-normal text-[#64748b]">Auto-verification runs as you type — required for UC, Super Cars & X-Suit delivery</span>
                </div>
              )}

              <button disabled={busy} className={`btn-primary mt-5 w-full !py-4 text-xs disabled:opacity-60 ${isQrMode ? "" : "!bg-[#16a34a] hover:!bg-[#15803d]"}`}>
                {isQrMode ? <><FiCreditCard className="text-lg" />{busy ? "GENERATING QR..." : `PAY ${formatINR(payableAmount)} & PLACE ORDER`}</> : <><FaWhatsapp className="text-lg" />{busy ? "OPENING WHATSAPP..." : "CONTINUE TO OFFICIAL WHATSAPP"}</>}
              </button>
              <p className="mt-3 text-center text-[10px] font-medium tracking-wide text-[#94a3b8]">{isQrMode ? "Secure UPI • Instant QR • Order saved automatically" : "Order will also be saved for admin tracking"}</p>
            </form>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
