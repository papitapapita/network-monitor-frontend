import type { NextConfig } from "next";

// Both fixed at build time. Dev and the pm2 install proxy to a backend on this
// machine and run `next start`; the Docker image proxies to the `backend`
// service of its compose project and runs the standalone server.
const backendUrl = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:3000";
const standalone = process.env.NEXT_STANDALONE === "true";

// Sent on every page. No script-src: Next's own inline scripts would need a
// nonce on every request; what matters here is that no other site can frame
// the sign-in screens, post a form to us or swap our base URL.
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Device IPs open the radio's own web UI; it has no business knowing which page sent us.
  { key: "Referrer-Policy", value: "same-origin" },
  // The location picker uses the browser's position; nothing else does.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()" },
  // Ignored over plain http (localhost); on the domain, browsers stay on https.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  output: standalone ? "standalone" : undefined,
  poweredByHeader: false,
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
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
