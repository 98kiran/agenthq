import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use 'standalone' for Docker builds, regular output for npm start
  ...(process.env.STANDALONE === 'true' ? { output: 'standalone' } : {}),
};

export default nextConfig;
