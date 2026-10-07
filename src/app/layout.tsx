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
 * Neon (`cache: "no-store"`) and `middleware.ts` / `proxy.ts` resolves the
 * Clerk session per request. Forcing dynamic rendering here stops Next.js
 * from trying to prerender pages at build time.
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

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { values } = await getPublicSettings();

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
          {/* Logs every page view (user email + IP + URL + timestamp) for the admin panel. */}
          <Suspense fallback={null}>
            <VisitTracker />
          </Suspense>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
