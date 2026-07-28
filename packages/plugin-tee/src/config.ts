import type { Hex } from "@gitbounty/core";

export interface VerifierConfig {
  port: number;
  /** GitHub token, injected as an enclave secret. */
  githubToken: string;
  /** Enclave signing key; the escrow's `teeSigner` must match its address. */
  signingKey: Hex;
  /** Escrow contract the signatures authorize payouts against. */
  escrowAddress: Hex;
  chainId: number;
}

const HEX_32_BYTES = /^0x[0-9a-fA-F]{64}$/;
const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function loadVerifierConfig(env: Record<string, string | undefined>): VerifierConfig {
  const githubToken = env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new Error("GITHUB_TOKEN is required");
  }
  const signingKey = env.TEE_SIGNING_KEY;
  if (!signingKey || !HEX_32_BYTES.test(signingKey)) {
    throw new Error("TEE_SIGNING_KEY must be a 32-byte hex private key");
  }
  const escrowAddress = env.ESCROW_ADDRESS;
  if (!escrowAddress || !HEX_ADDRESS.test(escrowAddress)) {
    throw new Error("ESCROW_ADDRESS must be a hex address");
  }

  return {
    port: Number(env.PORT ?? 8080),
    githubToken,
    signingKey: signingKey as Hex,
    escrowAddress: escrowAddress as Hex,
    chainId: Number(env.CHAIN_ID ?? 114),
  };
}
