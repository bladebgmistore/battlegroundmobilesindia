import type { NextRequest } from "next/server";

export type GeoInfo = {
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
};

const PRIVATE_IP =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|f[cd][0-9a-f]{2}:)/i;

/** Extract the real client IP from proxy / CDN headers. */
export function getClientIp(request: NextRequest): string | null {
  const candidates = [
    request.headers.get("x-nf-client-connection-ip"), // Netlify / Vercel
    request.headers.get("x-real-ip"),
    request.headers.get("cf-connecting-ip"), // Cloudflare
    request.headers.get("x-vercel-forwarded-for"), // Vercel
    ...(request.headers.get("x-forwarded-for") ?? "").split(","),
    request.headers.get("x-client-ip"),
  ];
  for (const raw of candidates) {
    const ip = raw?.trim();
    if (ip && ip !== "unknown") return ip.replace(/^::ffff:/, "");
  }
  return null;
}

function headerGeo(request: NextRequest): Omit<GeoInfo, "ip"> {
  // Vercel edge geo headers (free — no external call needed).
  const city = request.headers.get("x-vercel-ip-city");
  const region = request.headers.get("x-vercel-ip-country-region");
  const country = request.headers.get("x-vercel-ip-country");

  // Platform geo header (base64 JSON).
  let nfGeo: { city?: string; subdivision?: { name?: string }; country?: { name?: string } } | null = null;
  try {
    const raw = request.headers.get("x-nf-geo");
    if (raw) nfGeo = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    nfGeo = null;
  }

  return {
    city: (city && decodeURIComponent(city)) || nfGeo?.city || null,
    region: region || nfGeo?.subdivision?.name || null,
    country: country || nfGeo?.country?.name || null,
  };
}

async function fetchJson(url: string, timeoutMs: number): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve the buyer's IP + City/State/Country fully automatically.
 *
 * IMPORTANT: the location is ALWAYS looked up against the extracted client IP
 * first, so the shown location matches the shown IP. Platform geo headers
 * (Vercel / Netlify) are only a last-resort fallback because they describe
 * the connecting hop (often a CDN/proxy edge), which can differ from the
 * real client IP and produce a wrong city/state.
 *
 * Provider order (all keyed to the SAME client IP):
 *  1. ip-api.com   (free, no key)
 *  2. ipwho.is     (free, no key)
 *  3. ipapi.co     (free tier)
 *  4. Platform geo headers as final fallback.
 * Every step is wrapped in try/catch with a hard timeout so order placement
 * is NEVER blocked by geolocation.
 */
export async function resolveBuyerLocation(request: NextRequest): Promise<GeoInfo> {
  const ip = getClientIp(request);
  const fromHeaders = headerGeo(request);

  if (!ip || PRIVATE_IP.test(ip)) return { ip, ...fromHeaders };

  try {
    const primary = await fetchJson(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city`,
      2500,
    );
    if (primary?.status === "success" && (primary.city || primary.country)) {
      return {
        ip,
        city: (primary.city as string) || null,
        region: (primary.regionName as string) || null,
        country: (primary.country as string) || null,
      };
    }

    const secondary = await fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}`, 2500);
    if (secondary?.success === true && (secondary.city || secondary.country)) {
      return {
        ip,
        city: (secondary.city as string) || null,
        region: (secondary.region as string) || null,
        country: (secondary.country as string) || null,
      };
    }

    const fallback = await fetchJson(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, 2500);
    if (fallback && !fallback.error && (fallback.city || fallback.country_name)) {
      return {
        ip,
        city: (fallback.city as string) || null,
        region: (fallback.region as string) || null,
        country: (fallback.country_name as string) || null,
      };
    }
  } catch {
    // Silent — location is best-effort telemetry, never a blocker.
  }

  // Last resort: platform headers (may reflect the edge, but better than nothing).
  return { ip, ...fromHeaders };
}

export function formatLocation(geo: { city?: string | null; region?: string | null; country?: string | null }) {
  return [geo.city, geo.region, geo.country].filter(Boolean).join(", ");
}
