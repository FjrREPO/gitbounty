import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
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

/** How many cards one scroll step adds. */
export const PAGE_SIZE = 12;

/**
 * What the filter chips select. Not the same set as the escrow's `status`:
 * "expired" is a funded bounty whose deadline has passed, which the contract
 * has no state for. It is a pure function of `expiresAt`, so the subgraph can
 * answer it and the filter stays honest against what the chips show.
 */
export type BountyFilter = BountyStatus | "ALL" | "EXPIRED";

export interface PageArgs {
  status: BountyFilter;
  search: string;
  skip: number;
}

function whereClause(status: BountyFilter, search: string, nowSeconds: number): string {
  const parts = [
    status === "EXPIRED"
      ? `status: OPEN, expiresAt_lte: ${nowSeconds}`
      : // "Open" must mean claimable, so it excludes bounties past their deadline.
        status === "OPEN"
        ? `status: OPEN, expiresAt_gt: ${nowSeconds}`
        : status === "ALL"
          ? null
          : `status: ${status}`,
    search ? `repo_contains_nocase: ${JSON.stringify(search)}` : null,
  ].filter(Boolean);
  return parts.join(", ");
}

/**
 * One page of bounties. Plain async so the first page can be fetched on the
 * server and shipped as HTML, instead of the board being blank until the
 * browser has parsed the bundle and made the round trip itself.
 */
export async function fetchBountiesPage({ status, search, skip }: PageArgs): Promise<Bounty[]> {
  const where = whereClause(status, search, Math.floor(Date.now() / 1000));

  const data = await query<{ bounties: Bounty[] }>(
    `{
      bounties(
        first: ${PAGE_SIZE}
        skip: ${skip}
        orderBy: bountyId
        orderDirection: desc
        ${where ? `where: { ${where} }` : ""}
      ) { ${BOUNTY_FIELDS} }
    }`,
  );
  return data.bounties;
}

/**
 * Bounties for the board, one page at a time.
 *
 * The filter goes into the subgraph `where` clause rather than being applied
 * after the fact: filtering client-side would only ever search the pages
 * already scrolled past, which silently hides matches.
 */
export function useInfiniteBounties({
  status,
  search,
  initialBounties,
}: {
  status: BountyFilter;
  search: string;
  initialBounties?: Bounty[];
}) {
  const term = search.trim();

  return useInfiniteQuery({
    queryKey: ["bounties", status, term],
    initialPageParam: 0,
    // Only the unfiltered first page came from the server, so only that query
    // key may claim it; any filter has to go and ask.
    initialData:
      initialBounties && status === "ALL" && !term
        ? { pages: [initialBounties], pageParams: [0] }
        : undefined,
    queryFn: ({ pageParam }) => fetchBountiesPage({ status, search: term, skip: pageParam }),
    // A short page means the subgraph has nothing left, so stop asking.
    getNextPageParam: (last, pages) =>
      last.length < PAGE_SIZE ? undefined : pages.length * PAGE_SIZE,
    refetchInterval: 30_000,
  });
}

/** Protocol totals for the header, independent of which page is scrolled to. */
export function useProtocolStats() {
  return useQuery({
    queryKey: ["protocolStats"],
    queryFn: async () => {
      const data = await query<{ protocolStats: ProtocolStats | null }>(
        `{ protocolStats(id: "protocol") { totalBounties openBounties totalPaidWei } }`,
      );
      return data.protocolStats;
    },
    refetchInterval: 30_000,
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
