"use client";

import { FaWhatsapp } from "react-icons/fa";
import { FiCheck, FiFileText } from "react-icons/fi";
import { GridBackdrop, PageTitle, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { useStoreSettings } from "@/lib/use-store-settings";

type InfoKind = "how" | "terms" | "refund";

const rules = [
  "Payment is completed before the delivery process begins.",
  "Account ID & password login details are shared in your order section after the payment is confirmed.",
  "UC is credited to your account within 10–15 minutes of payment confirmation.",
  "Account ownership transfers after delivery is confirmed by both parties.",
];

export default function InfoPage({ kind }: { kind: InfoKind }) {
  const isHow = kind === "how";
  const isTerms = kind === "terms";
  const eyebrow = isHow ? "BUYING GUIDE" : isTerms ? "TERMS & CONDITIONS" : "REFUND POLICY";
  const title = isHow ? "A simple, guided buying flow." : isTerms ? "Terms for a fair, transparent marketplace." : "Refund expectations, stated clearly.";
  const copy = isHow ? "Choose your item, complete the payment, and receive your account or UC from your order section. Here is exactly how it works." : isTerms ? "Please review these conditions before beginning a purchase. They protect both buyers and the marketplace team." : "Digital goods require a precise policy. Please read this information before you make a payment.";

  return (
    <>
      <GridBackdrop />
      <SiteHeader />
      <main>
        <PageTitle eyebrow={eyebrow} title={title} copy={copy} />
        {isHow && <HowContent />}
        {isTerms && <TermsContent />}
        {kind === "refund" && <RefundContent />}
      </main>
      <SiteFooter />
    </>
  );
}

function HowContent() {
  const steps = [
    ["01", "Select Your Product", "Browse the store and choose the account or UC package that suits your game."],
    ["02", "Tap Buy Now", "Select the item you want and press the Buy Now button to open the secure checkout."],
    ["03", "Complete Payment", "Fill in your details and complete the payment. Your order is saved and shown in your account immediately."],
    ["04", "Receive In Order Section", "For accounts, your ID & password login details are shared in your order section after the payment is confirmed. For UC, the credit reaches your UC account within 10–15 minutes of payment confirmation."],
  ];

  return (
    <section className="mx-auto max-w-5xl px-5 pb-20 lg:px-8">
      <div className="relative ml-5 border-l border-[#cfe0f2] pl-8 sm:ml-8 sm:pl-12">
        {steps.map(([number, heading, body], i) => (
          <div key={number} className="relative pb-10 last:pb-0">
            <span className="absolute -left-[51px] grid h-10 w-10 place-items-center rounded-full border border-[#0f4c81]/30 bg-white text-[11px] font-black text-[#0f4c81] shadow-sm sm:-left-[69px]">{number}</span>
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
          <article key={h} className="rounded-xl border border-[#dbe2ec] premium-card p-6">
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
      <div className="rounded-2xl border border-[#0f4c81]/20 premium-card p-7">
        <p className="text-[10px] font-black tracking-[.16em] text-[#0f4c81]">DIGITAL GOODS POLICY</p>
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
