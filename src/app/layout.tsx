import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { SettingsProvider } from "@/components/settings-provider";
import { getPublicSettings } from "@/lib/site-settings";

export const metadata: Metadata = {
  metadataBase: new URL("https://battlegroundmobileindiastore.vercel.app"),
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
      <body>
        <SettingsProvider value={values}>{children}</SettingsProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
