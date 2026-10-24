import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Fixtures in data/ are read at runtime by the API routes; make sure Vercel ships them.
  outputFileTracingIncludes: { "/api/**": ["./data/**/*.json"] },
  async redirects() {
    return [{ source: "/queue", destination: "/anti-portfolio", permanent: false }];
  },
};

export default nextConfig;
