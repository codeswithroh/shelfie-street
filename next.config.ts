import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lets a production build run alongside `next dev` (NEXT_DIST_DIR=.next-build npm run build)
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
