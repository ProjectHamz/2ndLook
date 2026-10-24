import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Hide the "N" dev badge so it doesn't show in demo recordings (dev mode only; errors still show).
  devIndicators: false,
  // Fixtures in data/ are read at runtime by the API routes, and the memo page reads cached
  // notes from data/fixtures/llm; make sure Vercel ships them.
  outputFileTracingIncludes: { "/api/**": ["./data/**/*.json"], "/brief/**": ["./data/fixtures/llm/*.json"] },
  async redirects() {
    return [{ source: "/queue", destination: "/anti-portfolio", permanent: false }];
  },
};

export default nextConfig;
