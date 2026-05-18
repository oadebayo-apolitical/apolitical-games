import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Wikipedia/Wikimedia serve personality photos from these hosts.
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "*.wikipedia.org" },
    ],
  },
};

export default nextConfig;
