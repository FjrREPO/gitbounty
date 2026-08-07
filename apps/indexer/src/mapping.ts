import { BigInt } from "@graphprotocol/graph-ts";
import {
  BountyCreated,
  BountyPaid,
  BountyReclaimed,
  ClaimRegistered,
} from "../generated/GitBountyEscrow/GitBountyEscrow";
import { Bounty, Claim, ProtocolStats } from "../generated/schema";

const STATS_ID = "protocol";

function stats(): ProtocolStats {
  let s = ProtocolStats.load(STATS_ID);
  if (s == null) {
    s = new ProtocolStats(STATS_ID);
    s.totalBounties = BigInt.zero();
    s.openBounties = BigInt.zero();
    s.totalPaidWei = BigInt.zero();
  }
  return s;
}

export function handleBountyCreated(event: BountyCreated): void {
  const id = event.params.id.toString();
  const bounty = new Bounty(id);
  bounty.bountyId = event.params.id;
  bounty.funder = event.params.funder;
  bounty.repo = event.params.repo;
  bounty.issueNumber = event.params.issueNumber;
  bounty.amount = event.params.amount;
  bounty.rewardUsdCents = event.params.rewardUsdCents;
  bounty.expiresAt = event.params.expiresAt;
  bounty.status = "OPEN";
  bounty.createdAt = event.block.timestamp;
  bounty.createdTx = event.transaction.hash;
  bounty.save();

  const s = stats();
  s.totalBounties = s.totalBounties.plus(BigInt.fromI32(1));
  s.openBounties = s.openBounties.plus(BigInt.fromI32(1));
  s.save();
}

export function handleClaimRegistered(event: ClaimRegistered): void {
  const id = `${event.params.id.toString()}-${event.params.claimant.toHexString()}`;
  let claim = Claim.load(id);
  if (claim == null) {
    claim = new Claim(id);
    claim.bounty = event.params.id.toString();
    claim.claimant = event.params.claimant;
  }
  claim.prNumber = event.params.prNumber;
  claim.githubLoginHash = event.params.githubLoginHash;
  claim.registeredAt = event.block.timestamp;
  claim.save();
}

export function handleBountyPaid(event: BountyPaid): void {
  const bounty = Bounty.load(event.params.id.toString());
  if (bounty == null) {
    return;
  }
  bounty.status = "PAID";
  bounty.paidTo = event.params.recipient;
  bounty.paidAmount = event.params.paid;
  bounty.refundedAmount = event.params.refunded;
  bounty.paidAt = event.block.timestamp;
  bounty.save();

  const s = stats();
  s.openBounties = s.openBounties.minus(BigInt.fromI32(1));
  s.totalPaidWei = s.totalPaidWei.plus(event.params.paid);
  s.save();
}

export function handleBountyReclaimed(event: BountyReclaimed): void {
  const bounty = Bounty.load(event.params.id.toString());
  if (bounty == null) {
    return;
  }
  bounty.status = "RECLAIMED";
  bounty.reclaimedAt = event.block.timestamp;
  bounty.save();

  const s = stats();
  s.openBounties = s.openBounties.minus(BigInt.fromI32(1));
  s.save();
}
