import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { FiShield, FiUsers, FiArrowLeft, FiCheck, FiStar } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Join Elite Circle | Battleground Mobile India Store",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#eef1f6]">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#eef1f6]">
        <div className="animated-bg-mesh absolute inset-[-22%]" />
        <div className="animated-bg-scan absolute inset-[-35%] opacity-70" />
        <div className="absolute inset-[-22%] bg-[linear-gradient(rgba(15,76,129,.052)_1px,transparent_1px),linear-gradient(90deg,rgba(15,76,129,.052)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />
        <div className="absolute -left-32 top-10 h-[30rem] w-[30rem] rounded-full bg-[#0f4c81]/[.105] blur-[115px]" />
        <div className="absolute right-[-12rem] top-[28rem] h-[38rem] w-[38rem] rounded-full bg-[#0a3557]/[.085] blur-[125px]" />
        <div className="absolute left-1/2 top-[48rem] h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[#38bdf8]/[.16] blur-[105px]" />
      </div>

      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-8 px-5 py-10 lg:grid-cols-[1.05fr_.95fr] lg:px-8">
        <div className="order-2 lg:order-1">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl border border-[#e3e9f2] bg-white shadow-sm">
              <img src="/logo.png" alt="BGMI Store" className="h-full w-full object-cover" />
            </span>
            <span className="leading-none">
              <span className="block text-[10px] font-bold tracking-[.22em] text-[#0f4c81]">BATTLEGROUNDS MOBILE</span>
              <span className="mt-1 block text-sm font-extrabold tracking-[.12em] text-[#0f172a]">INDIA STORE</span>
            </span>
          </Link>

          <div className="mt-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#f4b400]/30 bg-[#fff8e1] px-3 py-1.5 text-[10px] font-black tracking-[.14em] text-[#8a6d00]">
              <FiStar className="text-[#f4b400]" /> ELITE CIRCLE • 12K+ TRUSTED PLAYERS
            </div>
            <h1 className="mt-6 text-4xl font-black leading-[0.9] tracking-[-.06em] text-[#0f172a] sm:text-[2.9rem]">
              JOIN THE
              <br />
              <span className="bg-gradient-to-r from-[#0f4c81] to-[#1b6fb0] bg-clip-text text-transparent">ELITE</span> CIRCLE.
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-[#64748b]">
              Create your secure account in 10 seconds. Track orders, unlock instant UPI checkout, and get priority support.
            </p>

            <div className="mt-8 grid gap-3">
              {[
                { k: "4.9/5", label: "Player Rating", sub: "From verified buyers" },
                { k: "8.6K+", label: "Orders Delivered", sub: "With guided handovers" },
                { k: "24/7", label: "WhatsApp Support", sub: "Official admin assistance" },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center gap-4 rounded-xl border border-[#e5e8ef] bg-white p-4">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#0f4c81] text-white">
                    <span className="text-sm font-black">{stat.k}</span>
                  </div>
                  <div>
                    <p className="text-sm font-black text-[#0f172a]">{stat.label}</p>
                    <p className="text-xs text-[#64748b]">{stat.sub}</p>
                  </div>
                  <FiCheck className="ml-auto text-[#0e9f6e]" />
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-[11px] font-bold text-[#64748b]">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#e5e8ef] bg-white px-3 py-1.5"><FiShield className="text-[#0f4c81]" /> Secure</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#e5e8ef] bg-white px-3 py-1.5"><FiUsers className="text-[#0f4c81]" /> Trusted</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#e5e8ef] bg-white px-3 py-1.5"><FaWhatsapp className="text-[#0e9f6e]" /> Support</span>
            </div>

            <Link href="/" className="mt-8 inline-flex items-center gap-2 text-[11px] font-black tracking-[.12em] text-[#64748b] hover:text-[#0f172a]">
              <FiArrowLeft /> EXPLORE STORE WITHOUT ACCOUNT
            </Link>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <div className="mx-auto w-full max-w-md">
            <SignUp
              appearance={{
                variables: { colorPrimary: "#0f4c81" },
                elements: {
                  rootBox: "w-full",
                  card: "shadow-[0_20px_60px_-20px_rgba(15,76,129,.35)] border border-[#e3e9f2] rounded-[1.25rem] bg-white",
                  header: "hidden",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  socialButtonsBlockButton: "border border-[#dbe2ec] bg-white hover:border-[#0f4c81] hover:bg-[#f8fafc] text-[#0f172a] font-bold rounded-xl py-3",
                  socialButtonsBlockButtonText: "font-black tracking-[.02em]",
                  formButtonPrimary: "bg-[#0f4c81] hover:bg-[#0a3557] text-white font-black tracking-[.04em] rounded-xl py-3.5 shadow-[0_8px_20px_-8px_rgba(15,76,129,.6)]",
                  formFieldInput: "rounded-xl border-[#dbe2ec] focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/20 py-3",
                  formFieldLabel: "text-[11px] font-black tracking-[.1em] text-[#334155]",
                  footerActionLink: "text-[#0f4c81] hover:text-[#0a3557] font-black",
                  developmentModeBadge: "hidden",
                  footer: "hidden",
                },
              }}
              routing="path"
              path="/sign-up"
              signInUrl="/sign-in"
              fallbackRedirectUrl="/dashboard"
              forceRedirectUrl="/dashboard"
            />
            <p className="mt-4 text-center text-[10px] leading-4 text-[#94a3b8]">
              By creating account, you agree to Terms & Refund Policy. Secured by Clerk.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
