import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // The production image optimizer rejected the local Supabase Storage URLs
    // ("url parameter is not allowed"), so serve images unoptimized for now —
    // the browser loads the original Storage URL directly. Re-enable optimization
    // at deploy by removing `unoptimized` and adding the cloud Supabase host below.
    unoptimized: true,
    // Local Supabase Storage. Add the cloud project host (e.g. <ref>.supabase.co) at deploy time.
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1", port: "54321", pathname: "/storage/**" },
      { protocol: "http", hostname: "localhost", port: "54321", pathname: "/storage/**" },
    ],
  },
};

export default nextConfig;
