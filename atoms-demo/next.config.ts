import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "sandpack.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.codesandbox.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "codesandbox.io",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
