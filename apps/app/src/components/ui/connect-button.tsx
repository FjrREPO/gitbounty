"use client";

import { useAppKit } from "@reown/appkit/react";
import { useAccount, useDisconnect } from "wagmi";
import { shorten } from "@/lib/format";

/** Header wallet control: connect when logged out, address chip when connected. */
export function ConnectButton() {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => open()}
          className="cursor-pointer rounded-full border border-foreground/15 px-4 py-1.5 font-mono text-xs text-foreground transition-colors hover:border-foreground/40"
        >
          {shorten(address)}
        </button>
        <button
          type="button"
          onClick={() => disconnect()}
          className="cursor-pointer rounded-full px-2 py-1.5 text-xs text-foreground/65 transition-colors hover:text-foreground"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => open()}
      className="cursor-pointer rounded-full bg-foreground px-4 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-80"
    >
      Connect Wallet
    </button>
  );
}
