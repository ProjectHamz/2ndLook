import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [{ source: "/queue", destination: "/anti-portfolio", permanent: false }];
  },
};

export default nextConfig;
