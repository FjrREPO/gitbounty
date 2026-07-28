import type { Bounty, PriceQuote, PullRequestRef, VerificationResult } from "./types.js";

/**
 * Verifies that a pull request resolving a bounty's issue was merged,
 * and produces a proof the escrow contract accepts.
 *
 * Implementations: FDC Web2Json (public repos), TEE (private repos / anonymous contributors).
 */
export interface VerificationProvider {
  readonly mode: Bounty["mode"];
  verify(bounty: Bounty, pullRequest: PullRequestRef): Promise<VerificationResult>;
}

/** Reads asset prices used to convert USD-denominated rewards at payout time. */
export interface PriceProvider {
  getQuote(feedId: string): Promise<PriceQuote>;
}
