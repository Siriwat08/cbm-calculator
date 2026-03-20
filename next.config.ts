import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // For Vercel deployment, we can remove "standalone" output
  // Vercel handles this automatically
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    remotePatterns: [],
    unoptimized: false,
  },
};

export default nextConfig;
