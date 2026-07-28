import {
  coston,
  coston2,
  FlareContractRegistryAddress,
  flare,
  songbird,
} from "@flarenetwork/flare-periphery-contract-artifacts";
import type { Hex, PriceProvider, PriceQuote } from "@gitbounty/core";
import { type Abi, createPublicClient, http, type PublicClient } from "viem";

export type FlareNetwork = "flare" | "songbird" | "coston" | "coston2";

const DEFAULT_RPC: Record<FlareNetwork, string> = {
  flare: "https://flare-api.flare.network/ext/C/rpc",
  songbird: "https://songbird-api.flare.network/ext/C/rpc",
  coston: "https://coston-api.flare.network/ext/C/rpc",
  coston2: "https://coston2-api.flare.network/ext/C/rpc",
};

const ARTIFACTS = { flare, songbird, coston, coston2 } as const;

export interface FtsoProviderConfig {
  network: FlareNetwork;
  /** Defaults to the public Flare RPC for the chosen network. */
  rpcUrl?: string;
}

/**
 * Reads live prices from FTSOv2 using the official Flare periphery artifacts.
 *
 * The FtsoV2 contract address is resolved through the FlareContractRegistry
 * (same address on every Flare network), so this provider works unchanged
 * across coston2, songbird, and mainnet.
 */
export class FtsoPriceProvider implements PriceProvider {
  private readonly client: PublicClient;
  private readonly abis: { registry: Abi; ftsoV2: Abi };
  private ftsoV2Address: Hex | undefined;

  constructor(config: FtsoProviderConfig) {
    const artifacts = ARTIFACTS[config.network];
    this.abis = {
      registry: artifacts.interfaceAbis.IFlareContractRegistry as Abi,
      ftsoV2: artifacts.interfaceAbis.FtsoV2Interface as Abi,
    };
    this.client = createPublicClient({
      transport: http(config.rpcUrl ?? DEFAULT_RPC[config.network]),
    });
  }

  async getQuote(feedId: string): Promise<PriceQuote> {
    const [value, decimals, timestamp] = (await this.client.readContract({
      address: await this.resolveFtsoV2(),
      abi: this.abis.ftsoV2,
      functionName: "getFeedById",
      args: [feedId],
    })) as [bigint, number, bigint];

    return {
      feedId,
      value,
      decimals,
      timestamp: Number(timestamp),
    };
  }

  private async resolveFtsoV2(): Promise<Hex> {
    if (!this.ftsoV2Address) {
      this.ftsoV2Address = (await this.client.readContract({
        address: FlareContractRegistryAddress as Hex,
        abi: this.abis.registry,
        functionName: "getContractAddressByName",
        args: ["FtsoV2"],
      })) as Hex;
    }
    return this.ftsoV2Address;
  }
}
