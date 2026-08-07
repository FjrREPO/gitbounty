import type { Hex } from "@gitbounty/core";
import { generatePrivateKey } from "viem/accounts";

export interface VerifierConfig {
  port: number;
  /** GitHub token, injected as an enclave secret. */
  githubToken: string;
  /**
   * Enclave signing key. Generated inside the enclave unless TEE_SIGNING_KEY
   * is set, so nobody outside can forge payout authorizations.
   */
  signingKey: Hex;
  /** True when the key was injected rather than generated in the enclave. */
  keyWasInjected: boolean;
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
  // A key handed in by the operator is a key the operator can sign with, so
  // the default is to mint one here and never let it leave. The escrow owner
  // then points `teeSigner` at the address reported by /healthz.
  // ponytail: the key dies with the VM; seal it to a KMS key released only
  // against an attestation if operators need restarts to preserve it.
  const injected = env.TEE_SIGNING_KEY;
  if (injected && !HEX_32_BYTES.test(injected)) {
    throw new Error("TEE_SIGNING_KEY must be a 32-byte hex private key");
  }
  const signingKey = injected ?? generatePrivateKey();
  const escrowAddress = env.ESCROW_ADDRESS;
  if (!escrowAddress || !HEX_ADDRESS.test(escrowAddress)) {
    throw new Error("ESCROW_ADDRESS must be a hex address");
  }

  return {
    port: Number(env.PORT ?? 8080),
    githubToken,
    signingKey: signingKey as Hex,
    keyWasInjected: Boolean(injected),
    escrowAddress: escrowAddress as Hex,
    chainId: Number(env.CHAIN_ID ?? 114),
  };
}
