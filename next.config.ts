import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the shop's iPad (same Wi-Fi/LAN) to load the development client.
  allowedDevOrigins: ["10.20.100.118"],
};

export default nextConfig;
