"use client";

import { flareTestnet } from "@reown/appkit/networks";
import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { http, WagmiProvider } from "wagmi";

// Free Reown project id (cloud.reown.com). Falls back to Reown's public demo id so the wallet modal
// works out of the box; set NEXT_PUBLIC_REOWN_PROJECT_ID to your own for production.
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "b56e18d47c72ab683b10814fe9495694";

const wagmiAdapter = new WagmiAdapter({
  networks: [flareTestnet],
  projectId,
  transports: { [flareTestnet.id]: http(process.env.NEXT_PUBLIC_COSTON2_RPC) },
  ssr: true,
});

// Wrapped so a wallet-modal init failure (bad projectId, relay unreachable) can never blank the app.
try {
  createAppKit({
    adapters: [wagmiAdapter],
    networks: [flareTestnet],
    defaultNetwork: flareTestnet,
    projectId,
    metadata: {
      name: "GitBounty",
      description: "Trustless GitHub bounties on Flare",
      url: "https://gitbounty.dev",
      icons: [],
    },
    themeMode: "light",
    features: {
      analytics: false,
      email: false,
      socials: [],
    },
  });
} catch (error) {
  console.error(
    "[wallet] AppKit init failed — the app still works, wallet modal may be limited",
    error,
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

/** Wallet + data layer for GitBounty on Flare Coston2. */
export function WalletProvider({ children }: PropsWithChildren) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
