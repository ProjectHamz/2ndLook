import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fixtures in data/ are read at runtime by the API routes; make sure Vercel ships them.
  outputFileTracingIncludes: { "/api/**": ["./data/**/*.json"] },
};

export default nextConfig;
