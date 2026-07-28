import type { PullRequestRef } from "@gitbounty/core";

/**
 * An FDC Web2Json attestation request. The FDC validator set fetches `url`,
 * applies the `postProcessJq` filter, and ABI-encodes the result so the
 * escrow contract can consume it as a Merkle-proven attestation.
 */
export interface Web2JsonRequest {
  attestationType: "Web2Json";
  url: string;
  httpMethod: "GET";
  postProcessJq: string;
  abiSignature: string;
}

/**
 * Builds the Web2Json request proving that a public-repo PR is merged.
 *
 * The jq filter extracts exactly the fields the escrow contract checks:
 * merge state, PR author, and the PR number itself.
 */
export function buildPrMergeAttestationRequest(ref: PullRequestRef): Web2JsonRequest {
  return {
    attestationType: "Web2Json",
    url: `https://api.github.com/repos/${ref.owner}/${ref.repo}/pulls/${ref.prNumber}`,
    httpMethod: "GET",
    postProcessJq: "{merged: .merged, author: .user.login, prNumber: .number}",
    abiSignature:
      '{"components":[{"internalType":"bool","name":"merged","type":"bool"},{"internalType":"string","name":"author","type":"string"},{"internalType":"uint256","name":"prNumber","type":"uint256"}],"internalType":"struct PrMerge","name":"prMerge","type":"tuple"}',
  };
}
