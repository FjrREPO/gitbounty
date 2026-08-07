/** Chain-agnostic hex string, e.g. an EVM address or tx hash. */
export type Hex = `0x${string}`;

/** Lifecycle of a bounty from funding to payout. */
export type BountyStatus = "open" | "claimed" | "verifying" | "paid" | "cancelled" | "expired";

/** How a merge is proven to the escrow contract. */
export type VerificationMode = "fdc-web2json" | "tee";

/** A GitHub issue a bounty is attached to. */
export interface IssueRef {
  owner: string;
  repo: string;
  issueNumber: number;
  /** Private repos can only use the TEE verification path. */
  isPrivate: boolean;
}

/** A pull request submitted to resolve a bounty issue. */
export interface PullRequestRef {
  owner: string;
  repo: string;
  prNumber: number;
}

/** A bounty escrowed on Flare, tied to a GitHub issue. */
export interface Bounty {
  id: Hex;
  issue: IssueRef;
  /** Reward denominated in USD; converted to FLR via FTSO at payout time. */
  rewardUsd: number;
  funder: Hex;
  status: BountyStatus;
  mode: VerificationMode;
  createdAt: number;
  /** Unix timestamp after which the funder can reclaim the escrow. */
  expiresAt: number;
}

/** Result of verifying that a PR resolving the bounty issue was merged. */
export interface VerificationResult {
  bounty: Bounty;
  pullRequest: PullRequestRef;
  merged: boolean;
  /** Wallet the contributor linked for payout. */
  payoutAddress: Hex;
  /** Attestation proof consumable by the escrow contract. */
  proof: Hex;
  verifiedAt: number;
}

/** A price observation from the FTSO feed. */
export interface PriceQuote {
  feedId: string;
  /** Price scaled by `decimals`. */
  value: bigint;
  decimals: number;
  timestamp: number;
}
