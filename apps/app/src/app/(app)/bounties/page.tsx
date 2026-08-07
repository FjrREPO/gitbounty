import type { Metadata } from "next";
import { API_URL } from "@/config/gitbounty";
import { fetchBountiesPage } from "@/lib/subgraph";
import { BountyBoard } from "./board";

/**
 * Repositories GitHub has no record of. The subgraph records every bounty ever
 * funded, including ones pointed at a repo that does not exist — those can
 * never be claimed and only add noise to the board. The API already tracks
 * which ones 404 while enriching, so this reuses that rather than probing.
 */
async function unresolvableRepos(): Promise<Set<string>> {
  try {
    const res = await fetch(`${API_URL}/api/v1/unresolvable`, { next: { revalidate: 300 } });
    const body = (await res.json()) as { repos?: string[] };
    return new Set(body.repos ?? []);
  } catch {
    return new Set();
  }
}

export const metadata: Metadata = {
  title: "Bounties",
  description: "Funded GitHub issues on Flare — open a pull request, get paid on merge.",
};

// The board changes whenever someone funds or claims a bounty, so the page is
// rendered per request and cached briefly rather than built once.
export const revalidate = 15;

export default async function BountiesPage() {
  // Fetched here so the first screenful arrives as HTML. If the subgraph is
  // unreachable the board still mounts and retries from the browser.
  const [page, hidden] = await Promise.all([
    fetchBountiesPage({ status: "ALL", search: "", skip: 0 }).catch(() => []),
    unresolvableRepos(),
  ]);

  return <BountyBoard initialBounties={page.filter((b) => !hidden.has(b.repo))} />;
}
