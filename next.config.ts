import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.sorare.com",
      },
      {
        protocol: "https",
        hostname: "*.sorare.com",
      },
      {
        protocol: "https",
        hostname: "sorare-assets.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "frontend-assets.sorare.com",
      },
    ],
  },
};

export default nextConfig;
