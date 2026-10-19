import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the Arena live-preview host (and any *.e2b.app subdomain) so Next.js
  // dev resources (HMR) work when the site is opened inside the sandbox preview.
  allowedDevOrigins: ["*.e2b.app"],
  // Gzip/brotli compression for faster page loads.
  compress: true,
  // Strip the x-powered-by header.
  poweredByHeader: false,
  async headers() {
    return [
      {
        /**
         * The public catalog is admin-editable and must never be served stale
         * by a CDN. A previous `s-maxage=30` rule (plus 120s of
         * stale-while-revalidate) kept newly published products and
         * re-enabled categories invisible long after the database write.
         */
        source: "/api/store",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Vercel-CDN-Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
