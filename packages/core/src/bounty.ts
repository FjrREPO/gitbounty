import type { Bounty, BountyStatus, PriceQuote } from "./types.js";

const TRANSITIONS: Record<BountyStatus, readonly BountyStatus[]> = {
  open: ["claimed", "cancelled", "expired"],
  claimed: ["verifying", "open", "expired"],
  verifying: ["paid", "claimed"],
  paid: [],
  cancelled: [],
  expired: [],
};

/** Whether a bounty may move from its current status to `next`. */
export function canTransition(bounty: Bounty, next: BountyStatus): boolean {
  return TRANSITIONS[bounty.status].includes(next);
}

/** Returns a copy of the bounty in the new status, or throws on an illegal transition. */
export function transition(bounty: Bounty, next: BountyStatus): Bounty {
  if (!canTransition(bounty, next)) {
    throw new Error(`illegal bounty transition: ${bounty.status} -> ${next}`);
  }
  return { ...bounty, status: next };
}

/** Whether the escrow can be reclaimed by the funder. */
export function isExpired(bounty: Bounty, nowUnix: number): boolean {
  return bounty.status === "open" && nowUnix >= bounty.expiresAt;
}

/** Approximate token value of a wei amount, rounded to `decimals` places. */
export function weiToToken(wei: bigint, decimals = 4): number {
  const scale = 10n ** BigInt(18 - decimals);
  return Number(wei / scale) / 10 ** decimals;
}

/**
 * Converts a USD-denominated reward into token units (wei) using an FTSO quote.
 * The quote value is `price * 10^decimals` for 1 token in USD.
 */
export function rewardInTokenWei(rewardUsd: number, quote: PriceQuote): bigint {
  if (quote.value <= 0n) {
    throw new Error(`invalid FTSO quote for ${quote.feedId}: ${quote.value}`);
  }
  const usdScaled = BigInt(Math.round(rewardUsd * 10 ** quote.decimals));
  return (usdScaled * 10n ** 18n) / quote.value;
}
