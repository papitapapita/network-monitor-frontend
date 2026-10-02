import type { NextConfig } from "next";

// Both fixed at build time. Dev and the pm2 install proxy to a backend on this
// machine and run `next start`; the Docker image proxies to the `backend`
// service of its compose project and runs the standalone server.
const backendUrl = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:3000";
const standalone = process.env.NEXT_STANDALONE === "true";

const nextConfig: NextConfig = {
  output: standalone ? "standalone" : undefined,
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
