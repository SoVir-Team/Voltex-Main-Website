import path from "node:path";
import type { NextConfig } from "next";

// Where the Next.js server reaches the API. In production Nginx also routes /api straight to the API.
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../"),
  poweredByHeader: false,
  // Tailwind CSS v4 runs as a Turbopack loader, on the one stylesheet that uses it: matching every *.css would
  // turn the ESP32 Labs' CSS Modules into plain global CSS.
  turbopack: {
    root: path.join(__dirname, "../"),
    rules: {
      "globals.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  images: {
    qualities: [75, 85],
    formats: ["image/avif", "image/webp"],
    // Uploaded product photos are served by the API under /api/uploads.
    localPatterns: [{ pathname: "/images/**" }, { pathname: "/brand/**" }, { pathname: "/api/uploads/**" }],
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_INTERNAL_URL}/api/:path*` }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [{ source: "/products", destination: "/our-products", permanent: true }];
  },
};

export default nextConfig;
