import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { images } from "@/lib/store-data";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const CACHE_HEADERS = {
  // Cache for 5 minutes so a logo change in the admin panel reflects quickly.
  "Cache-Control": "public, max-age=300, s-maxage=300",
};

/** Decode a `data:image/...;base64,....` URL into bytes + content type. */
function decodeDataUrl(dataUrl: string): { bytes: Buffer; contentType: string } | null {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!match) return null;
  const contentType = match[1] || "image/png";
  const payload = match[3] || "";
  const bytes = match[2]
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");
  return { bytes, contentType };
}

/**
 * Serves the SAME logo the admin configured in Site Controls as the favicon,
 * so the browser tab icon always matches the site logo. Falls back to the
 * default store logo when no custom logo is set.
 */
export async function GET() {
  let logoUrl = "";
  try {
    const rows = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.settingKey, "logo_url"))
      .limit(1);
    logoUrl = String(rows[0]?.value ?? "").trim();
  } catch {
    // DB offline — fall through to the default logo.
  }

  // Uploaded logos are stored as Base64 data URLs — serve them directly.
  if (logoUrl.startsWith("data:")) {
    const decoded = decodeDataUrl(logoUrl);
    if (decoded) {
      return new Response(new Uint8Array(decoded.bytes), {
        headers: { "Content-Type": decoded.contentType, ...CACHE_HEADERS },
      });
    }
  }

  const candidates = [logoUrl, images.logo].filter(
    (url) => url && /^https?:\/\//i.test(url),
  );

  for (const url of candidates) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
      clearTimeout(timer);
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") ?? "image/png";
      if (!contentType.startsWith("image/")) continue;
      const bytes = await response.arrayBuffer();
      return new Response(bytes, {
        headers: { "Content-Type": contentType, ...CACHE_HEADERS },
      });
    } catch {
      // Try the next candidate.
    }
  }

  // Absolute last resort: a tiny transparent PNG so the tab never 404s.
  const transparentPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  );
  return new Response(new Uint8Array(transparentPng), {
    headers: { "Content-Type": "image/png", ...CACHE_HEADERS },
  });
}
