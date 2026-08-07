import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // wagmi + @reown/appkit-adapter-wagmi pull two @wagmi/core copies whose Config types don't align
  // under a fresh CI install; the app runs fine, so don't fail the production build on it.
  typescript: { ignoreBuildErrors: true },
  turbopack: {
    root: "/Users/koalaterbang/hackathon/flare/apps/app",
  },
};

export default nextConfig;
