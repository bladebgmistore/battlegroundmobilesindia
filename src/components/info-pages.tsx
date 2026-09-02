"use client";

import Link from "next/link";
import { FaWhatsapp } from "react-icons/fa";
import { FiCheck, FiClock, FiFileText, FiLock, FiShield, FiUserCheck } from "react-icons/fi";
import { images } from "@/lib/store-data";
import { GridBackdrop, PageTitle, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { useStoreSettings } from "@/lib/use-store-settings";

type InfoKind = "safe" | "how" | "terms" | "refund";

const rules = [
  "Payment is completed before the delivery process begins.",
  "No refund is available after successful delivery or account transfer.",
  "Screen recording is strongly recommended during the full handover.",
  "Never share an OTP, recovery code, or device-security code.",
  "Account ownership transfers after delivery is confirmed by both parties.",
];

export default function InfoPage({ kind }: { kind: InfoKind }) {
  const isSafe = kind === "safe";
  const isHow = kind === "how";
  const isTerms = kind === "terms";
  const eyebrow = isSafe ? "SAFETY CENTRE" : isHow ? "BUYING GUIDE" : isTerms ? "TERMS & CONDITIONS" : "REFUND POLICY";
  const title = isSafe ? "A clear, guided delivery process." : isHow ? "From selection to handover." : isTerms ? "Terms for a fair, transparent marketplace." : "Refund expectations, stated clearly.";
  const copy = isSafe ? "We believe confidence starts with knowing what will happen next. Learn how our support-led delivery process works and what to protect." : isHow ? "The buying flow is deliberately simple. Select the item you like and our official support team will guide the remaining steps." : isTerms ? "Please review these conditions before beginning a purchase. They protect both buyers and the marketplace team." : "Digital goods require a precise policy. Please read this information before you make a payment.";

  return (
    <>
      <GridBackdrop />
      <SiteHeader />
      <main>
        <PageTitle eyebrow={eyebrow} title={title} copy={copy} />
        {isSafe && <SafetyContent />}
        {isHow && <HowContent />}
        {isTerms && <TermsContent />}
        {kind === "refund" && <RefundContent />}
      </main>
      <SiteFooter />
    </>
  );
}

function SafetyContent() {
  const points = [
    [FiUserCheck, "How accounts are delivered", "Support confirms the selected listing and coordinates a controlled handover. Please verify every step before confirming delivery."],
    [FiClock, "Delivery time", "Timing is confirmed by the support desk based on product availability. Most requests are addressed promptly after verification."],
    [FiShield, "Why the process is safer", "Clear listing details, direct support communication and an encouraged screen recording help keep the handover accountable."],
    [FiLock, "Buyer protection practices", "Keep your communication in the official channel, do not reveal OTPs, and record the delivery flow for your own reference."],
  ];

  return (
    <section className="mx-auto max-w-7xl px-5 pb-20 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
        <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-white/[.1]">
          <img src={images.safety} alt="Account safety visual" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(4,6,5,.92))]" />
          <div className="absolute bottom-0 p-7">
            <p className="text-[10px] font-black tracking-[.16em] text-[#0f4c81]">PROTECT YOURSELF</p>
            <p className="mt-2 max-w-sm text-xl font-black leading-6 text-[#0f172a]">Use only the official support channel and keep your proof of handover.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {points.map(([Icon, heading, body]) => {
            const IconComponent = Icon as typeof FiShield;
            return (
              <article key={heading as string} className="rounded-2xl premium-card p-6">
                <IconComponent className="text-xl text-[#0f4c81]" />
                <h2 className="mt-5 text-lg font-black text-[#0f172a]">{heading as string}</h2>
                <p className="mt-3 text-sm leading-6 text-[#64748b]">{body as string}</p>
              </article>
            );
          })}
        </div>
      </div>
      <Rules />
    </section>
  );
}

function HowContent() {
  const steps = [
    ["01", "Select Product", "Review the listed details and choose the account or UC package that suits your game."],
    ["02", "Click Buy", "Select the Buy button. You will see the current gateway-maintenance notice and support route."],
    ["03", "Contact WhatsApp", "Share your selection through the official WhatsApp button. The team will confirm the next steps."],
    ["04", "Complete Payment", "Complete the agreed payment after your requirements are confirmed by official support."],
    ["05", "Receive Product", "Follow the guided account handover or UC completion flow, keeping a screen recording for your records."],
  ];

  return (
    <section className="mx-auto max-w-5xl px-5 pb-20 lg:px-8">
      <div className="relative ml-5 border-l border-[#0f4c81]/25 pl-8 sm:ml-8 sm:pl-12">
        {steps.map(([number, heading, body], i) => (
          <div key={number} className="relative pb-10 last:pb-0">
            <span className="absolute -left-[51px] grid h-10 w-10 place-items-center rounded-full border border-[#0f4c81]/35 bg-[#0f4c81] text-[11px] font-black text-white sm:-left-[69px]">{number}</span>
            <p className="text-[10px] font-black tracking-[.15em] text-[#0f4c81]">STEP {i + 1}</p>
            <h2 className="mt-2 text-2xl font-black text-[#0f172a]">{heading}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#64748b]">{body}</p>
          </div>
        ))}
      </div>
      <Rules />
    </section>
  );
}

function TermsContent() {
  return (
    <section className="mx-auto max-w-4xl px-5 pb-20 lg:px-8">
      <div className="space-y-4">
        {[
          ["Independent marketplace", "Battleground Official India Store is an independent BGMI digital marketplace. It is not affiliated with, endorsed by, or sponsored by Krafton or BGMI."],
          ["Product information", "Listings are provided with material inventory details. Buyers should read a listing and clarify any concerns with support before payment."],
          ["Buyer responsibility", "Buyers must provide accurate contact details, protect their personal security details, and follow the handover instructions shared by support."],
          ["Delivery confirmation", "The delivery process is treated as completed after the buyer has been provided the agreed product and confirms the delivery flow."],
          ["Acceptable conduct", "Threatening, abusive, fraudulent, or deceptive behavior may result in a request being declined and access to support being restricted."],
        ].map(([h, b]) => (
          <article key={h} className="rounded-xl border border-white/[.09] premium-card p-6">
            <FiFileText className="text-[#0f4c81]" />
            <h2 className="mt-3 text-lg font-black text-[#0f172a]">{h}</h2>
            <p className="mt-2 text-sm leading-6 text-[#64748b]">{b}</p>
          </article>
        ))}
      </div>
      <Rules />
    </section>
  );
}

function RefundContent() {
  return (
    <section className="mx-auto max-w-4xl px-5 pb-20 lg:px-8">
      <div className="rounded-2xl border border-[#e8bd45]/25 premium-card p-7">
        <p className="text-[10px] font-black tracking-[.16em] text-[#edc650]">DIGITAL GOODS POLICY</p>
        <h2 className="mt-3 text-2xl font-black text-[#0f172a]">No refund after successful delivery.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#64748b]">Because products are digital and account ownership can transfer immediately, we cannot reverse a completed delivery. Please inspect the listing and ask support any questions before making payment.</p>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl premium-card p-6">
          <h2 className="text-lg font-black text-[#0f172a]">Before delivery</h2>
          <p className="mt-3 text-sm leading-6 text-[#64748b]">If a confirmed item becomes unavailable before delivery, our support team will offer an alternative option or discuss the appropriate resolution.</p>
        </article>
        <article className="rounded-xl premium-card p-6">
          <h2 className="text-lg font-black text-[#0f172a]">Record the process</h2>
          <p className="mt-3 text-sm leading-6 text-[#64748b]">We strongly recommend a continuous screen recording during account handover. It provides useful evidence for all parties.</p>
        </article>
      </div>
      <Rules />
    </section>
  );
}

function Rules() {
  const { whatsapp } = useStoreSettings();

  return (
    <div className="mt-10 premium-card p-6">
      <p className="text-[10px] font-bold tracking-[.17em] text-[#0f4c81]">IMPORTANT RULES</p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {rules.map((rule) => (
          <p key={rule} className="flex gap-2 text-xs leading-5 text-[#64748b]">
            <FiCheck className="mt-0.5 shrink-0 text-[#0f4c81]" />
            {rule}
          </p>
        ))}
      </div>
      <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 text-[10px] font-black tracking-[.12em] text-[#0f4c81]">
        <FaWhatsapp className="text-base" /> ASK SUPPORT A QUESTION
      </a>
    </div>
  );
}
