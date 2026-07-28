import type { Hex } from "@gitbounty/core";
import { encodeAbiParameters, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Builds the digest `GitBountyEscrow.claimWithTeeProof` recovers against:
 * `keccak256(abi.encode(chainId, escrow, bountyId, recipient))`, later
 * wrapped in the EIP-191 prefix by the signature itself.
 */
export function payoutDigest(params: {
  chainId: number;
  escrow: Hex;
  bountyId: bigint;
  recipient: Hex;
}): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "address" }, { type: "uint256" }, { type: "address" }],
      [BigInt(params.chainId), params.escrow, params.bountyId, params.recipient],
    ),
  );
}

/**
 * Signs payout authorizations with the enclave key. The private key never
 * leaves this process — in Confidential Space that means it never leaves
 * hardware-protected memory.
 */
export class PayoutSigner {
  private readonly account: ReturnType<typeof privateKeyToAccount>;

  constructor(
    privateKey: Hex,
    private readonly chainId: number,
    private readonly escrow: Hex,
  ) {
    this.account = privateKeyToAccount(privateKey);
  }

  /** The address the escrow's `teeSigner` must be set to. */
  get address(): Hex {
    return this.account.address;
  }

  /** Signs the authorization for `recipient` to claim `bountyId`. */
  async sign(bountyId: bigint, recipient: Hex): Promise<Hex> {
    const digest = payoutDigest({
      chainId: this.chainId,
      escrow: this.escrow,
      bountyId,
      recipient,
    });
    return this.account.signMessage({ message: { raw: digest } });
  }
}
