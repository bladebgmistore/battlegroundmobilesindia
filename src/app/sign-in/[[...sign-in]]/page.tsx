import { SignIn } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign In | Battleground Mobile India Store",
  robots: { index: false, follow: false },
};

/**
 * Clerk Sign-In page — replaces old custom Google login.
 * 
 * Configured to support:
 * - Continue with Google (OAuth)
 * - Email OTP / Magic Link
 * - Phone Number OTP (SMS)
 * 
 * These methods are enabled in Clerk Dashboard → User & Authentication → 
 * Email, Phone, Social Connections. The UI below automatically shows
 * whichever methods are enabled.
 */
export default function Page() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#eef1f6] px-5 py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-[11px] font-black tracking-[.22em] text-[#0f4c81]">BATTLEGROUNDS MOBILE INDIA STORE</p>
          <h1 className="mt-2 text-2xl font-black tracking-[-.03em] text-[#0f172a]">Welcome back</h1>
          <p className="mt-2 text-sm leading-6 text-[#64748b]">
            Sign in to continue to your dashboard, orders and admin panel.
          </p>
        </div>
        <SignIn
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
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/dashboard"
          forceRedirectUrl="/dashboard"
        />
        <p className="mt-6 text-center text-[11px] leading-5 text-[#94a3b8]">
          By signing in, you agree to our Terms & Conditions. Your data is secured by Clerk.
          <br />
          Owner access: <span className="font-mono font-bold text-[#0f4c81]">manavjeph800@gmail.com</span> → Admin Panel
        </p>
      </div>
    </main>
  );
}
