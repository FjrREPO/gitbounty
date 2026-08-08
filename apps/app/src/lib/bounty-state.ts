import type { Bounty } from "@/lib/subgraph";

/**
 * What a bounty is *actually* in, as opposed to what the escrow stores.
 *
 * The contract only knows three states, because those are the only ones it can
 * enforce: funded, paid out, refunded. Two situations it cannot see change what
 * a reader should do about a bounty, and both of them still read as `OPEN`:
 *
 * - the deadline has passed, so no claim can settle and the funder may refund;
 * - GitHub already closed the issue, so the work is likely done and starting
 *   fresh on it is wasted effort.
 *
 * Deriving them here keeps the escrow honest — no extra on-chain state to keep
 * in sync — while the UI stops telling people a bounty is open when it is not.
 */
export type DisplayStatus = "OPEN" | "STALE" | "EXPIRED" | "PAID" | "RECLAIMED";

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  OPEN: "open",
  STALE: "issue closed",
  EXPIRED: "expired",
  PAID: "paid",
  RECLAIMED: "reclaimed",
};

export function isExpired(bounty: Bounty, nowMs = Date.now()): boolean {
  return Number(bounty.expiresAt) * 1000 <= nowMs;
}

export function displayStatus(
  bounty: Bounty,
  issueState?: "open" | "closed",
  nowMs = Date.now(),
): DisplayStatus {
  if (bounty.status !== "OPEN") {
    return bounty.status;
  }
  // Expiry outranks a closed issue: once the deadline passes nothing can
  // settle, whatever GitHub says.
  if (isExpired(bounty, nowMs)) {
    return "EXPIRED";
  }
  return issueState === "closed" ? "STALE" : "OPEN";
}

/** Whether `address` may pull the escrow back right now. */
export function canReclaim(bounty: Bounty, address?: string, nowMs = Date.now()): boolean {
  return (
    bounty.status === "OPEN" &&
    isExpired(bounty, nowMs) &&
    !!address &&
    address.toLowerCase() === bounty.funder.toLowerCase()
  );
}
