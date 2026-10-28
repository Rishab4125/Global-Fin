import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs"],
  // Old addresses keep working: Misc and Realised moved into Gains, Settings into the account menu.
  async redirects() {
    return [
      { source: "/realised", destination: "/gains", permanent: false },
      { source: "/realised/export", destination: "/gains/export", permanent: false },
      { source: "/misc", destination: "/gains/misc", permanent: false },
      { source: "/settings", destination: "/profile/tax", permanent: false },
    ];
  },
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
