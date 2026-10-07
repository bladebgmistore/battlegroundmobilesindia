import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { SettingsProvider } from "@/components/settings-provider";
import { getPublicSettings } from "@/lib/site-settings";
import { Suspense } from "react";
import VisitTracker from "@/components/visit-tracker";
import { GamingEnhancements } from "@/components/gaming-enhancements";
import { ClerkProvider } from "@clerk/nextjs";

/**
 * Root layout - now wrapped with ClerkProvider for compulsory authentication.
 * 
 * Every route is request-scoped: the root layout reads live site settings from
 * Neon (`cache: "no-store"`) and `proxy.ts` resolves the Clerk session per request.
 * Forcing dynamic rendering stops Next.js from prerendering pages at build time.
 * 
 * If Clerk env vars are missing, we render without ClerkProvider and show
 * a configuration error instead of crashing with 500.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL("https://battlegroundmobilesindia.shop"),
  title: {
    default: "Battleground Mobile India Store",
    template: "%s | Battleground Mobile India Store",
  },
  description:
    "Premium BGMI accounts and UC packages with detailed listings, guided delivery, and official WhatsApp support.",
  keywords: ["BGMI accounts", "BGMI UC", "Battleground Mobile India Store", "gaming marketplace", "BGMI store"],
  icons: {
    icon: "/api/favicon",
    shortcut: "/api/favicon",
    apple: "/api/favicon",
  },
  openGraph: {
    title: "Battleground Mobile India Store",
    description: "Premium digital marketplace for the BGMI community.",
    type: "website",
    locale: "en_IN",
    images: ["/logo.png"],
  },
  robots: { index: true, follow: true },
};

function MissingClerkConfig({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="grid min-h-screen place-items-center bg-[#eef1f6] px-5 py-16">
          <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-8 shadow-xl">
            <h1 className="text-2xl font-black text-red-600">Clerk Configuration Missing</h1>
            <p className="mt-3 text-sm leading-6 text-[#64748b]">
              <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> or <code>CLERK_SECRET_KEY</code> is missing.
              This causes Internal Server Error.
            </p>
            <div className="mt-5 rounded-xl bg-[#f8fafc] p-4 text-xs font-mono">
              <p>1. Add to Vercel → Settings → Environment Variables:</p>
              <p className="mt-2">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...</p>
              <p>CLERK_SECRET_KEY=sk_live_...</p>
              <p>OWNER_EMAIL=manavjeph800@gmail.com</p>
              <p className="mt-3">2. If using custom domain clerk.battlegroundmobilesindia.shop:</p>
              <p>   Add DNS CNAME: clerk.battlegroundmobilesindia.shop → frontend-api.clerk.dev</p>
              <p>   (Check Clerk Dashboard → Custom Domains)</p>
              <p className="mt-3">3. Redeploy</p>
            </div>
            <p className="mt-5 text-[11px] text-[#94a3b8]">
              Current env check: <a href="/api/auth/config-check" className="underline text-[#0f4c81]">/api/auth/config-check</a>
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { values } = await getPublicSettings();
  const hasClerkKeys = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

  // If Clerk keys missing, show config error instead of crashing with 500
  if (!hasClerkKeys) {
    return <MissingClerkConfig>{children}</MissingClerkConfig>;
  }

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#0f4c81",
        },
        elements: {
          formButtonPrimary: "bg-[#0f4c81] hover:bg-[#0a3557] text-white",
          card: "shadow-xl border border-[#e3e9f2]",
        },
      }}
    >
      <html lang="en">
        <head>
          <link rel="stylesheet" href="https://unpkg.com/aos@2.3.4/dist/aos.css" />
          <style
            dangerouslySetInnerHTML={{
              __html: `html:not(.reveal-ready) body [data-aos]{opacity:1!important;transform:none!important;transition:none!important}html.reveal-ready body [data-aos]{opacity:0!important;transform:translate3d(0,24px,0) scale(.985)!important;transition:opacity .62s ease,transform .62s cubic-bezier(.2,.8,.2,1)!important}html.reveal-ready body [data-aos=zoom-in]{transform:scale(.955)!important}html.reveal-ready body [data-aos=fade-left]{transform:translate3d(34px,0,0)!important}html.reveal-ready body [data-aos=fade-right]{transform:translate3d(-34px,0,0)!important}html.reveal-ready body [data-aos].reveal-visible{opacity:1!important;transform:none!important}`,
            }}
          />
          <script
            dangerouslySetInnerHTML={{
              __html: `window.$crisp=[];window.CRISP_WEBSITE_ID="2c8d03b1-d974-49ec-a013-585fe13bd77e";(function(){d=document;s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();`,
            }}
          />
        </head>
        <body>
          <SettingsProvider value={values}>{children}</SettingsProvider>
          <GamingEnhancements />
          {/* Logs every page view (user email + IP + URL + timestamp) for admin panel */}
          <Suspense fallback={null}>
            <VisitTracker />
          </Suspense>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
