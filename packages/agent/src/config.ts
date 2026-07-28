import os from "node:os";
import path from "node:path";
import type { FlareNetwork } from "@gitbounty/plugin-ftso";
import type { RepoTarget } from "./types.js";

export interface AgentConfig {
  githubToken: string;
  /** Repositories to watch, from GITBOUNTY_REPOS="owner/repo,owner2/repo2". */
  repos: RepoTarget[];
  /** Issues carrying this label are treated as bounties. */
  bountyLabel: string;
  /** Flare network used for FTSO price quotes. */
  network: FlareNetwork;
  /** Wallet the agent links for payouts; advertised in its PRs. */
  payoutAddress: string | undefined;
  workdir: string;
  gitUserName: string;
  gitUserEmail: string;
}

const NETWORKS: FlareNetwork[] = ["flare", "songbird", "coston", "coston2"];

export function loadConfig(env: Record<string, string | undefined>): AgentConfig {
  const githubToken = env.GITBOUNTY_GITHUB_TOKEN ?? env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new Error("GITBOUNTY_GITHUB_TOKEN (or GITHUB_TOKEN) is required");
  }

  const reposRaw = env.GITBOUNTY_REPOS;
  if (!reposRaw) {
    throw new Error('GITBOUNTY_REPOS is required, e.g. "owner/repo,owner2/repo2"');
  }
  const repos = reposRaw.split(",").map((entry): RepoTarget => {
    const [owner, repo] = entry.trim().split("/");
    if (!owner || !repo) {
      throw new Error(`invalid GITBOUNTY_REPOS entry: "${entry}"`);
    }
    return { owner, repo };
  });

  const network = env.GITBOUNTY_NETWORK ?? "coston2";
  if (!NETWORKS.includes(network as FlareNetwork)) {
    throw new Error(`invalid GITBOUNTY_NETWORK: "${network}"`);
  }

  return {
    githubToken,
    repos,
    bountyLabel: env.GITBOUNTY_LABEL ?? "bounty",
    network: network as FlareNetwork,
    payoutAddress: env.GITBOUNTY_PAYOUT_ADDRESS,
    workdir: env.GITBOUNTY_WORKDIR ?? path.join(os.tmpdir(), "gitbounty-agent"),
    gitUserName: env.GITBOUNTY_GIT_NAME ?? "gitbounty-agent",
    gitUserEmail: env.GITBOUNTY_GIT_EMAIL ?? "agent@gitbounty.dev",
  };
}
