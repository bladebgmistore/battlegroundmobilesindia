import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { SettingsProvider } from "@/components/settings-provider";

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

// NOTE: We intentionally do NOT read site settings from the database here.
// This layout wraps EVERY page, including pages that Next.js statically
// prerenders at build time (`/`, `/accounts`, `/contact`, ...). A database
// query in this file uses a no-store fetch, which Next.js forbids during
// static generation and throws "Dynamic server usage ... DYNAMIC_SERVER_USAGE"
// for every page on every deploy. Public settings (WhatsApp number, logo,
// maintenance mode, ...) are already fetched live in the browser from
// `/api/store` by `useStoreSettings`, so removing the server-side read changes
// no visible behaviour — it only stops the build-time error spam.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SettingsProvider value={{}}>{children}</SettingsProvider>
        <Analytics />
      </body>
    </html>
  );
}
