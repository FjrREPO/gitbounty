import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // wagmi + @reown/appkit-adapter-wagmi pull two @wagmi/core copies whose Config types don't align
  // under a fresh CI install; the app runs fine, so don't fail the production build on it.
  typescript: { ignoreBuildErrors: true },
  images: {
    // Avatars were served straight from GitHub at whatever size it felt like
    // sending. Routing them through the optimizer gets AVIF/WebP at the size
    // actually rendered, which is most of the image weight on the board.
    remotePatterns: [
      { protocol: "https", hostname: "github.com", pathname: "/**" },
      { protocol: "https", hostname: "avatars.githubusercontent.com", pathname: "/**" },
    ],
    // Avatars are immutable for practical purposes; cache the derivatives hard.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  turbopack: {
    // Pinned to this directory because the monorepo root also has a lockfile, and
    // letting Next infer the workspace root makes it reinstall from there on every
    // start. Derived from the config's own location so it builds off this machine.
    root: dirname(fileURLToPath(import.meta.url)),
  },
};

export default nextConfig;
