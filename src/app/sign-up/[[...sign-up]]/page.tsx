import { SignUp } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign Up | Battleground Mobile India Store",
  robots: { index: false, follow: false },
};

/**
 * Clerk Sign-Up page — supports Google, Email OTP, Phone OTP.
 */
export default function Page() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#eef1f6] px-5 py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-[11px] font-black tracking-[.22em] text-[#0f4c81]">BATTLEGROUNDS MOBILE INDIA STORE</p>
          <h1 className="mt-2 text-2xl font-black tracking-[-.03em] text-[#0f172a]">Create account</h1>
          <p className="mt-2 text-sm leading-6 text-[#64748b]">
            Join the premium BGMI marketplace — Google, Email OTP or Phone OTP.
          </p>
        </div>
        <SignUp
          appearance={{
            variables: {
              colorPrimary: "#0f4c81",
            },
            elements: {
              formButtonPrimary: "bg-[#0f4c81] hover:bg-[#0a3557] text-white font-bold",
              card: "shadow-xl border border-[#e3e9f2] rounded-2xl",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              socialButtonsBlockButton: "border border-[#dbe2ec] hover:border-[#0f4c81] font-bold",
              formFieldInput: "rounded-xl border-[#dbe2ec] focus:border-[#0f4c81]",
              footerActionLink: "text-[#0f4c81] hover:text-[#0a3557] font-bold",
            },
          }}
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          fallbackRedirectUrl="/dashboard"
          forceRedirectUrl="/dashboard"
        />
      </div>
    </main>
  );
}
