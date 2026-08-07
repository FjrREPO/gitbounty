"use client";

import { useQuery } from "@tanstack/react-query";
import ky from "ky";
import { SUBGRAPH_URL } from "@/config/gitbounty";

export type BountyStatus = "OPEN" | "PAID" | "RECLAIMED";

export interface Claim {
  id: string;
  claimant: string;
  prNumber: string;
  registeredAt: string;
}

export interface Bounty {
  bountyId: string;
  funder: string;
  repo: string;
  issueNumber: string;
  amount: string;
  rewardUsdCents: string;
  expiresAt: string;
  status: BountyStatus;
  createdAt: string;
  createdTx: string;
  paidTo: string | null;
  paidAmount: string | null;
  refundedAmount: string | null;
  claims: Claim[];
}

export interface ProtocolStats {
  totalBounties: string;
  openBounties: string;
  totalPaidWei: string;
}

const BOUNTY_FIELDS = `
  bountyId
  funder
  repo
  issueNumber
  amount
  rewardUsdCents
  expiresAt
  status
  createdAt
  createdTx
  paidTo
  paidAmount
  refundedAmount
  claims { id claimant prNumber registeredAt }
`;

async function query<T>(gql: string): Promise<T> {
  const res = await ky
    .post(SUBGRAPH_URL, { json: { query: gql } })
    .json<{ data?: T; errors?: { message: string }[] }>();
  if (res.errors?.length) {
    throw new Error(res.errors[0].message);
  }
  if (!res.data) {
    throw new Error("empty subgraph response");
  }
  return res.data;
}

/** All bounties, newest first, refreshed every 15s. */
export function useBounties() {
  return useQuery({
    queryKey: ["bounties"],
    queryFn: async () => {
      const data = await query<{
        bounties: Bounty[];
        protocolStats: ProtocolStats | null;
      }>(
        `{
          bounties(first: 200, orderBy: bountyId, orderDirection: desc) { ${BOUNTY_FIELDS} }
          protocolStats(id: "protocol") { totalBounties openBounties totalPaidWei }
        }`,
      );
      return data;
    },
    refetchInterval: 15_000,
  });
}

/** One bounty by id. */
export function useBounty(id: string) {
  return useQuery({
    queryKey: ["bounty", id],
    queryFn: async () => {
      const data = await query<{ bounty: Bounty | null }>(
        `{ bounty(id: "${encodeURIComponent(id)}") { ${BOUNTY_FIELDS} } }`,
      );
      return data.bounty;
    },
    enabled: /^\d+$/.test(id),
    refetchInterval: 15_000,
  });
}
