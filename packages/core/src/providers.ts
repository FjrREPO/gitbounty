import type { Bounty, Hex, PriceQuote, PullRequestRef, VerificationResult } from "./types.js";

/**
 * Verifies that a pull request resolving a bounty's issue was merged,
 * and produces a proof the escrow contract accepts.
 *
 * Implementations: FDC Web2Json (public repos), TEE (private repos / anonymous contributors).
 */
export interface VerificationProvider {
  readonly mode: Bounty["mode"];
  /**
   * @param recipient Wallet the payout is authorized for. The TEE path binds
   *   it into the signature; the FDC path derives it from the on-chain claim.
   */
  verify(bounty: Bounty, pullRequest: PullRequestRef, recipient: Hex): Promise<VerificationResult>;
}

/** Reads asset prices used to convert USD-denominated rewards at payout time. */
export interface PriceProvider {
  getQuote(feedId: string): Promise<PriceQuote>;
}
