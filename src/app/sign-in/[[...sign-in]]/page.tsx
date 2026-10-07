import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { FiShield, FiLock, FiArrowLeft, FiCheck } from "react-icons/fi";
import { FaBolt } from "react-icons/fa";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign In | Battleground Mobile India Store",
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
            <div className="inline-flex items-center gap-2 rounded-full border border-[#cfe3f7] bg-white px-3 py-1.5 text-[10px] font-black tracking-[.14em] text-[#0f4c81]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0e9f6e]" /> SECURE CHECKOUT • ELITE INVENTORY
            </div>
            <h1 className="mt-6 text-4xl font-black leading-[0.95] tracking-[-.05em] text-[#0f172a] sm:text-5xl">
              WELCOME
              <br />
              <span className="text-[#0f4c81]">BACK.</span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-[#64748b]">
              Sign in to access your orders, saved inventory and instant UPI checkout. 
              Premium BGMI marketplace trusted by 12K+ players.
            </p>

            <div className="mt-8 grid gap-3">
              {[
                { icon: FiShield, title: "Guided Handovers", desc: "Verified account delivery with support" },
                { icon: FiLock, title: "Secure by Clerk", desc: "Google • Email OTP • Phone OTP" },
                { icon: FaBolt, title: "Instant Checkout", desc: "UPI QR with order tracking" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-3 rounded-xl border border-[#e5e8ef] bg-white p-4">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#e0eefb] text-[#0f4c81]">
                    <Icon />
                  </span>
                  <div>
                    <p className="text-sm font-black text-[#0f172a]">{title}</p>
                    <p className="mt-0.5 text-xs text-[#64748b]">{desc}</p>
                  </div>
                  <FiCheck className="ml-auto mt-1 text-[#0e9f6e]" />
                </div>
              ))}
            </div>

            <Link href="/" className="mt-8 inline-flex items-center gap-2 text-[11px] font-black tracking-[.12em] text-[#64748b] hover:text-[#0f172a]">
              <FiArrowLeft /> BACK TO STORE — BROWSE WITHOUT LOGIN
            </Link>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <div className="mx-auto w-full max-w-md">
            <SignIn
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
                  identityPreviewText: "font-bold",
                  formFieldAction: "text-[#0f4c81] font-bold",
                  developmentModeBadge: "hidden",
                  footer: "hidden",
                },
              }}
              routing="path"
              path="/sign-in"
              signUpUrl="/sign-up"
              fallbackRedirectUrl="/dashboard"
              forceRedirectUrl="/dashboard"
            />
            <p className="mt-4 flex items-center justify-center gap-2 text-center text-[10px] leading-4 text-[#94a3b8]">
              <FiLock className="shrink-0" /> Secured by Clerk • Encrypted • Private
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
