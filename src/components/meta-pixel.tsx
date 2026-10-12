"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { FACEBOOK_PIXEL_ENABLED, FACEBOOK_PIXEL_ID, pageview } from "@/lib/fpixel";

/**
 * Meta (Facebook) Pixel loader — render it once from `src/app/layout.tsx`.
 *
 * - Injects the official base code (with `fbq('init', …)` and the first
 *   `fbq('track', 'PageView')`) only when `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` is
 *   configured, so local/preview builds without the env var stay clean.
 * - Sends one extra PageView per App-Router navigation (client-side route
 *   changes don't reload the document, so the base snippet can't see them).
 * - Includes the `<noscript>` tracking pixel for visitors without JavaScript.
 *
 * Renders nothing if the pixel ID is missing or the base script is blocked.
 */
function baseCode(pixelId: string): string {
  return `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');`;
}

export default function MetaPixel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The base code already reports the very first PageView, so the initial
  // effect run is skipped — otherwise every landing would count twice.
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    pageview();
  }, [pathname, searchParams]);

  if (!FACEBOOK_PIXEL_ENABLED) return null;

  // Only digits/dashes/underscores are valid in a pixel id — never inject raw
  // env content into inline JavaScript.
  const pixelId = FACEBOOK_PIXEL_ID.replace(/[^A-Za-z0-9_-]/g, "");

  return (
    <>
      <Script
        id="meta-pixel-base"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: baseCode(pixelId) }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          alt=""
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
