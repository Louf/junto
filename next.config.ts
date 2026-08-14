import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Hosts allowed to reach dev-only resources like the HMR socket.
   *
   * The browser treats 127.0.0.1 and localhost as different origins, and Next
   * blocks cross-origin access to dev resources by default — the page loads
   * but never hydrates, so every control appears dead.
   *
   * Add your machine's LAN address here too when testing on a phone over
   * wifi (e.g. "192.168.1.42"), or the same thing happens there.
   *
   * Development only; ignored in production builds.
   */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
