"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { FiArrowLeft, FiCheckCircle, FiCopy, FiDownload, FiShield, FiClock, FiCreditCard, FiUpload, FiLoader, FiLock, FiUser, FiX } from "react-icons/fi";
import { formatINR, buildUpiUrl, buildQrImageUrl } from "@/lib/store-data";
import { GridBackdrop, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { useStoreSettings } from "@/lib/use-store-settings";
import { compressImageFile, formatBytes } from "@/lib/client-image";
import { purchase } from "@/lib/fpixel";

type UploadState = "idle" | "compressing" | "uploading" | "done" | "error";

export default function PaymentPage() {
  const params = useSearchParams();
  const router = useRouter();
  const orderCode = params.get("orderCode") ?? "BG-XXXX";
  const product = params.get("product") ?? "Selected product";
  const amount = Number(params.get("amount") ?? 0);
  const baseAmount = Number(params.get("baseAmount") ?? amount);
  const coupon = params.get("coupon");
  const discount = Number(params.get("discount") ?? 0);
  const uid = params.get("uid") ?? "";
  const ign = params.get("ign") ?? "";
  const category = (params.get("category") ?? "").trim();
  /** UC top-ups never land in the buyer's order history — see requirement 2. */
  const isUcOrder = category === "uc";

  const { upiId } = useStoreSettings();
  const [copied, setCopied] = useState(false);
  const [showPaidModal, setShowPaidModal] = useState(false);
  const [screenshot, setScreenshot] = useState("");
  const [screenshotBytes, setScreenshotBytes] = useState(0);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [transactionRef, setTransactionRef] = useState("");
  // Guard against a double submission after the success screen appears.
  const [paid, setPaid] = useState(false);

  const upiUrl = buildUpiUrl({ upiId, amount, orderCode, productName: product });
  const qrUrl = buildQrImageUrl(upiUrl);

  const screenshotUploaded = uploadState === "done";

  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const uploadScreenshot = async (file?: File) => {
    if (!file) return;
    setUploadError("");
    setUploadState("compressing");
    try {
      // 1. Compress client-side — guaranteed < 2 MB before it leaves the browser.
      const compressed = await compressImageFile(file);
      setScreenshot(compressed.dataUrl);
      setScreenshotBytes(compressed.bytes);

      // 2. Upload the compressed Base64 straight to our same-origin API
      //    (stored on the order row — no CORS, no 413).
      setUploadState("uploading");
      const response = await fetch("/api/orders/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderCode, screenshot: compressed.dataUrl }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error ?? "Upload failed. Please try again.");
      }
      setUploadState("done");
    } catch (error) {
      setUploadState("error");
      setUploadError(error instanceof Error ? error.message : "Could not process the screenshot. Please try again.");
    }
  };

  const transactionValid = /^[A-Za-z0-9]{6,40}$/.test(transactionRef.trim());
  const canConfirm = !paid && screenshotUploaded && (!isUcOrder || transactionValid);

  const handlePaid = async () => {
    if (!canConfirm || busy) return;
    setBusy(true);
    try {
      await fetch("/api/orders/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode,
          markPaid: true,
          transactionId: transactionRef.trim() || null,
        }),
      }).catch(() => null);

      // Meta Pixel: buyer confirmed the UPI transfer + payment screenshot.
      // Revenue is reported in INR with the store's own order code.
      purchase({
        orderId: orderCode,
        value: amount,
        currency: "INR",
        items: [{ id: product, name: product, price: amount, category: "upi-checkout" }],
        paymentMethod: "upi",
      });

      setPaid(true);
      setShowPaidModal(true);
      // UC purchases are handled by the admin's UC Orders desk, so the buyer
      // stays on the confirmation screen instead of "My Orders".
      if (!isUcOrder) {
        router.prefetch?.("/account");
        setTimeout(() => router.push("/account"), 2400);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <GridBackdrop />
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-10 lg:px-8 lg:py-14">
        <Link href="/" className="inline-flex items-center gap-2 text-[10px] font-black tracking-[.12em] text-[#64748b] transition-colors hover:text-[#0f172a]">
          <FiArrowLeft /> BACK TO HOME
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
          {/* Left: QR */}
          <div className="premium-card fade-in p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e0eefb] text-[#0f4c81]"><FiCreditCard className="text-xl" /></div>
              <div>
                <p className="text-[10px] font-black tracking-[.15em] text-[#0f4c81]">SECURE UPI PAYMENT</p>
                <h1 className="text-xl font-black text-[#0f172a]">Scan & Pay {formatINR(amount)}</h1>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center">
              <div className="rounded-2xl border border-[#dbe2ec] bg-white p-4 shadow-[0_10px_36px_rgba(15,76,129,.12)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt={`UPI QR for ${formatINR(amount)}`} width={280} height={280} className="h-[280px] w-[280px] object-contain" />
              </div>
              <p className="mt-4 flex items-center gap-2 rounded-full bg-[#e0eefb] px-3 py-1.5 text-[10px] font-black tracking-wide text-[#0f4c81]"><FiClock /> QR valid for this order • Amount fixed</p>

              <div className="mt-6 w-full rounded-xl border border-[#dbe2ec] bg-[#f8fafc] p-4">
                <p className="text-[10px] font-black tracking-[.12em] text-[#64748b]">UPI ID</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="truncate font-mono text-sm font-black text-[#0f172a]">{upiId}</p>
                  <button onClick={copyUpi} className="inline-flex items-center gap-1.5 rounded-lg border border-[#dbe2ec] bg-white px-3 py-2 text-[10px] font-black text-[#0f172a] transition-colors hover:border-[#0f4c81] hover:bg-[#f1f5fb]">
                    <FiCopy /> {copied ? "COPIED" : "COPY"}
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-[#64748b]">Amount</span>
                  <span className="text-lg font-black text-[#0f4c81]">{formatINR(amount)}</span>
                </div>
                {discount > 0 && (
                  <p className="mt-1 text-right text-[10px] font-bold text-[#64748b]">Coupon {coupon} saved {formatINR(discount)}</p>
                )}
              </div>

              <div className="mt-4 grid w-full grid-cols-2 gap-3">
                <a href={upiUrl} className="btn-primary !py-3.5 text-center text-xs">
                  <FiCreditCard /> OPEN UPI APP
                </a>
                <a href={qrUrl} download={`QR-${orderCode}.png`} target="_blank" rel="noopener noreferrer" className="btn-outline !py-3.5 text-center text-xs">
                  <FiDownload /> DOWNLOAD QR
                </a>
              </div>

              <p className="mt-4 text-center text-[10px] leading-4 text-[#94a3b8]">UPI apps: Google Pay • PhonePe • Paytm • BHIM • Any UPI app<br />Scanning will open your UPI app with amount pre-filled</p>
            </div>
          </div>

          {/* Right: Order Details */}
          <div className="space-y-5">
            <div className="premium-card slide-up p-6">
              <p className="text-[10px] font-bold tracking-[.15em] text-[#0f4c81]">ORDER CONFIRMED</p>
              <h2 className="mt-3 text-2xl font-black leading-6 text-[#0f172a]">{product}</h2>
              <div className="mt-5 space-y-2.5 rounded-xl border border-[#e5e8ef] bg-[#f8fafc] p-4 text-sm">
                <div className="flex justify-between"><span className="text-[#64748b]">Order ID</span><span className="font-mono font-black text-[#0f4c81]">{orderCode}</span></div>
                <div className="flex justify-between"><span className="text-[#64748b]">Product</span><span className="font-bold text-[#0f172a] text-right max-w-[60%] truncate">{product}</span></div>
                {uid && <div className="flex justify-between"><span className="text-[#64748b]">BGMI UID</span><span className="font-mono font-black text-[#0f4c81]">{uid}</span></div>}
                {ign && <div className="flex justify-between"><span className="text-[#64748b]">Player Name</span><span className="inline-flex items-center gap-1.5 font-black text-[#0e9f6e]"><FiUser /> {ign}</span></div>}
                <div className="my-2 h-px bg-[#e5e8ef]" />
                <div className="flex justify-between"><span className="text-[#64748b]">Base Price</span><span className="text-[#0f172a]">{formatINR(baseAmount)}</span></div>
                {discount > 0 && <div className="flex justify-between text-[#0e9f6e]"><span>Discount ({coupon})</span><span>-{formatINR(discount)}</span></div>}
                <div className="flex justify-between text-base"><span className="font-bold text-[#0f172a]">Payable</span><span className="text-xl font-black text-[#0f4c81]">{formatINR(amount)}</span></div>
              </div>

              <div className="mt-5 rounded-xl border border-[#d9e4f0] bg-[#f3f8fe] p-4">
                <p className="flex items-center gap-2 text-xs font-black text-[#0f4c81]"><FiShield /> HOW TO PAY</p>
                <ol className="mt-3 list-decimal list-inside space-y-2 text-xs leading-5 text-[#334155]">
                  <li>Open any UPI app (GPay / PhonePe / Paytm)</li>
                  <li>Tap <b className="text-[#0f172a]">Scan & Pay</b> and scan the QR</li>
                  <li>Verify amount <b className="text-[#0f172a]">{formatINR(amount)}</b> and UPI ID <b className="text-[#0f172a]">{upiId}</b></li>
                  <li>Upload the payment screenshot below</li>
                  <li>Tap <b className="text-[#0f172a]">I Have Paid</b> to finish</li>
                </ol>
              </div>

              {/* UPI transaction reference (UTR) — required for UC orders so the
                  admin can reconcile the payment in the UC Orders desk. */}
              <div className="mt-5 rounded-xl border border-[#dbe2ec] bg-white p-4">
                <label htmlFor="transaction-ref" className="flex flex-wrap items-center gap-2 text-[10px] font-black tracking-wide text-[#0f4c81]">
                  <FiCreditCard /> TRANSACTION ID / UTR
                  {isUcOrder ? <span className="text-red-500">*REQUIRED</span> : <span className="font-bold text-[#94a3b8]">(OPTIONAL)</span>}
                </label>
                <input
                  id="transaction-ref"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 40))}
                  inputMode="text"
                  autoComplete="off"
                  placeholder="e.g. 412345678901"
                  className="mt-2 w-full rounded-xl border border-[#dbe2ec] px-3.5 py-3 font-mono text-sm font-bold text-[#0f172a] outline-none transition focus:border-[#0f4c81]"
                />
                <p className="mt-2 text-[10px] leading-4 text-[#94a3b8]">
                  Copy the 12-digit reference from your UPI app (GPay / PhonePe / Paytm) — found in the payment details of the transaction.
                </p>
              </div>

              {/* Screenshot upload — REQUIRED to unlock the paid button */}
              <div className={`mt-5 rounded-xl border p-4 transition-colors duration-300 ${screenshotUploaded ? "border-[#bbe7d4] bg-[#effaf5]" : "border-[#dbe2ec] bg-white"}`}>
                <p className="flex items-center gap-2 text-[10px] font-black tracking-wide text-[#0f4c81]">
                  <FiUpload /> UPLOAD PAYMENT SCREENSHOT <span className="text-red-500">*REQUIRED</span>
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {screenshot && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={screenshot} alt="Payment screenshot preview" className="fade-in h-16 w-16 rounded-lg border border-[#dbe2ec] object-cover" />
                  )}
                  <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-3 text-xs font-bold transition-all duration-200 ${uploadState === "compressing" || uploadState === "uploading" ? "border-[#dbe2ec] bg-[#f8fafc] text-[#94a3b8]" : "border-[#dbe2ec] text-[#0f4c81] hover:border-[#0f4c81] hover:bg-[#f1f5fb]"}`}>
                    {uploadState === "compressing" || uploadState === "uploading" ? <FiLoader className="animate-spin" /> : <FiUpload />}
                    {uploadState === "compressing" ? "COMPRESSING…" : uploadState === "uploading" ? "UPLOADING…" : screenshotUploaded ? "CHANGE IMAGE" : "CHOOSE IMAGE"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadState === "compressing" || uploadState === "uploading"}
                      onChange={(e) => {
                        void uploadScreenshot(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {screenshotUploaded && (
                    <span className="fade-in inline-flex items-center gap-1.5 rounded-full bg-[#0e9f6e]/10 px-3 py-1.5 text-[10px] font-black text-[#0e9f6e]">
                      <FiCheckCircle /> UPLOADED • {formatBytes(screenshotBytes)}
                    </span>
                  )}
                </div>
                {uploadState === "error" && uploadError && (
                  <p className="fade-in mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600">{uploadError}</p>
                )}
                {!screenshotUploaded && uploadState !== "error" && (
                  <p className="mt-3 text-[10px] leading-4 text-[#94a3b8]">Image is auto-compressed under 2 MB in your browser before upload. The <b>I Have Paid</b> button unlocks after a successful upload.</p>
                )}
              </div>

              <button
                onClick={handlePaid}
                disabled={!canConfirm || busy}
                className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-black tracking-wide transition-all duration-300 ${
                  canConfirm
                    ? "bg-[#0f4c81] text-white shadow-[0_10px_26px_rgba(15,76,129,.28)] hover:-translate-y-0.5 hover:bg-[#0a3557]"
                    : "cursor-not-allowed bg-[#e2e8f0] text-[#94a3b8]"
                }`}
              >
                {busy ? <FiLoader className="animate-spin text-lg" /> : canConfirm ? <FiCheckCircle className="text-lg" /> : <FiLock className="text-lg" />}
                {paid
                  ? "ORDER CONFIRMED"
                  : !screenshotUploaded
                    ? "UPLOAD SCREENSHOT TO UNLOCK"
                    : isUcOrder && !transactionValid
                      ? "ENTER TRANSACTION ID TO CONFIRM"
                      : "I HAVE PAID - CONFIRM ORDER"}
              </button>
              <p className="mt-3 text-center text-[10px] text-[#94a3b8]">Your payment will be verified by the admin before delivery. Keep your payment screenshot safe.</p>
            </div>

            <div className="premium-card p-5">
              <p className="flex items-center gap-2 text-xs font-black tracking-wide text-[#64748b]"><FiShield className="text-[#0f4c81]" /> Buyer Protection</p>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-[#64748b]">
                <li>• Order is saved instantly with ID <b className="text-[#0f172a]/80">{orderCode}</b></li>
                <li>• Payment screenshot is stored securely with your order</li>
                <li>• Admin will verify payment and deliver within minutes</li>
                <li>• Screen-record the payment for safety</li>
              </ul>
            </div>
          </div>
        </div>

        {showPaidModal && (
          <div className="modal-overlay fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowPaidModal(false)}>
            <div onClick={(e) => e.stopPropagation()} className="modal-card w-full max-w-md rounded-2xl border border-[#dbe2ec] bg-white p-6 text-center shadow-[0_30px_80px_rgba(15,40,70,.25)]">
              <button onClick={() => setShowPaidModal(false)} aria-label="Close" className="ml-auto grid h-8 w-8 place-items-center rounded-full text-[#94a3b8] transition-colors hover:bg-[#f1f5fb] hover:text-[#0f172a]"><FiX /></button>
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#0e9f6e]/12 text-2xl text-[#0e9f6e]"><FiCheckCircle /></div>
              <h3 className="mt-4 text-xl font-black text-[#0f172a]">
                {isUcOrder ? "Order Confirmed!" : "Payment Noted!"}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#64748b]">
                {isUcOrder
                  ? "Your order has been confirmed successfully! Our team is processing it."
                  : <>Your order <b className="text-[#0f172a]">{orderCode}</b> for <b className="text-[#0f172a]">{formatINR(amount)}</b> has been saved with your payment screenshot. Admin verification will happen shortly before delivery.</>}
              </p>
              {isUcOrder && (
                <p className="mt-3 rounded-lg border border-[#cfe3f7] bg-[#f3f8fe] px-3 py-2 text-[11px] leading-5 text-[#0f4c81]">
                  Your UC will be credited to Player ID <b className="font-mono">{uid || "—"}</b>. Keep an eye on WhatsApp for the delivery update.
                </p>
              )}
              {!isUcOrder && (
                <p className="mt-3 flex items-center justify-center gap-2 text-[11px] font-black tracking-[.1em] text-[#0f4c81]"><FiLoader className="animate-spin" /> TAKING YOU TO MY ORDERS…</p>
              )}
              <button onClick={() => router.push(isUcOrder ? "/" : "/account")} className="btn-primary mt-4 w-full justify-center !py-3 text-xs">
                {isUcOrder ? "BACK TO STORE" : "GO TO MY ORDERS"}
              </button>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
