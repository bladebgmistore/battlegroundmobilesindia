import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { SettingsProvider } from "@/components/settings-provider";
import { getPublicSettings } from "@/lib/site-settings";
import { Suspense } from "react";
import VisitTracker from "@/components/visit-tracker";
import { GamingEnhancements } from "@/components/gaming-enhancements";

/**
 * Every route is request-scoped: the root layout reads live site settings from
 * Neon (`cache: "no-store"`) and `src/proxy.ts` resolves the session per
 * request. Forcing dynamic rendering here stops Next.js from trying to
 * prerender pages at build time — which is what produced the noisy
 * "DYNAMIC_SERVER_USAGE / Error connecting to database" logs during deploys.
 * It cascades to every nested route, so individual pages don't need it.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL("https://battlegroundmobileindiastore.netlify.app"),
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
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://unpkg.com/aos@2.3.4/dist/aos.css" />
        <style
          dangerouslySetInnerHTML={{
            __html: `html:not(.aos-ready) body [data-aos] { opacity: 1 !important; transform: none !important; transition: none !important; }`,
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
  );
}
