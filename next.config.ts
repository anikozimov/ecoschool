import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./security.config.mjs";

const securityHeaders = buildSecurityHeaders({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  isDev: process.env.NODE_ENV !== "production",
});

const DEMO_EXPORT = process.env.DEMO_EXPORT === "1";
// Cloudflare uchun statik eksport (npm run build:cf). Xavfsizlik sarlavhalari out/_headers orqali beriladi.
const STATIC_EXPORT = DEMO_EXPORT || process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(STATIC_EXPORT ? { output: "export" as const, trailingSlash: true, images: { unoptimized: true } } : {}),
  // Demo havola boshqa manzil ostida ochiladi — fayllar nisbiy yo'l bilan yuklanadi
  ...(DEMO_EXPORT ? { assetPrefix: "." } : {}),
  cacheComponents: !STATIC_EXPORT,
  partialPrefetching: !STATIC_EXPORT,
  poweredByHeader: false,
  turbopack: {
    resolveAlias: {
      // Demo ma'lumotlari faqat demo buildga kiradi
      "demo-client": process.env.NEXT_PUBLIC_DEMO === "1" ? "./lib/demo-client.ts" : "./lib/demo-client.stub.ts",
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  ...(STATIC_EXPORT
    ? {}
    : {
        async headers() {
          return [{ source: "/:path*", headers: securityHeaders }];
        },
      }),
};

export default nextConfig;
