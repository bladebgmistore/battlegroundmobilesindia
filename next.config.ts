import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gzip/brotli compression for faster page loads.
  compress: true,
  // Strip the x-powered-by header.
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Long-lived immutable caching for build assets.
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // Short CDN cache + stale-while-revalidate for the public catalog API.
        source: "/api/store",
        headers: [{ key: "Cache-Control", value: "public, s-maxage=30, stale-while-revalidate=120" }],
      },
    ];
  },
};

export default nextConfig;
