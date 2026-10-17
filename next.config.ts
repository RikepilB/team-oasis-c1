import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/*": ["./data/fixtures/demo/**/*", "./standard/**/*", "./skills/**/*"],
  },
  async headers() {
    return [{ source: "/fonts/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
