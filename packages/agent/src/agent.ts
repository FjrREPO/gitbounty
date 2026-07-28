import type { PriceProvider } from "@gitbounty/core";
import { rewardInTokenWei, weiToToken } from "@gitbounty/core";
import { FLR_USD } from "@gitbounty/plugin-ftso";
import type { IssueSummary } from "@gitbounty/plugin-github";
import type { AgentConfig } from "./config.js";
import { collectRepoContext } from "./context.js";
import type {
  FixGenerator,
  GeneratedFix,
  GitHubPort,
  RepoFile,
  RepoTarget,
  WorkspacePort,
} from "./types.js";

const BOUNTY_AMOUNT_LABEL = /^bounty:\s*\$?(\d+(?:\.\d+)?)$/i;

/** Extracts a USD amount from labels like `bounty:$50` or `bounty: 25`. */
export function parseBountyUsd(labels: string[]): number | null {
  for (const label of labels) {
    const match = BOUNTY_AMOUNT_LABEL.exec(label.trim());
    if (match?.[1]) {
      return Number.parseFloat(match[1]);
    }
  }
  return null;
}

export function branchForIssue(issue: IssueSummary): string {
  return `gitbounty/issue-${issue.number}`;
}

export interface SolvedBounty {
  repo: RepoTarget;
  issueNumber: number;
  prNumber: number;
  prUrl: string;
}

export interface AgentReport {
  solved: SolvedBounty[];
  skipped: { repo: RepoTarget; issueNumber: number; reason: string }[];
}

export interface AgentDeps {
  github: GitHubPort;
  generator: FixGenerator;
  workspace: WorkspacePort;
  /** FTSO-backed price source used to estimate rewards in FLR. */
  price?: PriceProvider;
  /** Overridable for tests; defaults to reading the cloned repo. */
  collectContext?: (repoDir: string) => Promise<RepoFile[]>;
  log?: (message: string) => void;
}

/**
 * The autonomous bounty hunter: watches repos for bounty-labeled issues,
 * generates a fix, pushes a branch, and opens a PR whose merge triggers the
 * on-chain payout to the agent's wallet.
 */
export class BountyAgent {
  constructor(
    private readonly config: AgentConfig,
    private readonly deps: AgentDeps,
  ) {}

  async runOnce(): Promise<AgentReport> {
    const report: AgentReport = { solved: [], skipped: [] };
    for (const repo of this.config.repos) {
      const issues = await this.deps.github.listOpenIssues(
        repo.owner,
        repo.repo,
        this.config.bountyLabel,
      );
      for (const issue of issues) {
        try {
          const solved = await this.solve(repo, issue);
          if (solved) {
            report.solved.push(solved);
          } else {
            report.skipped.push({ repo, issueNumber: issue.number, reason: "pr already open" });
          }
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          this.log(`issue #${issue.number} in ${repo.owner}/${repo.repo} failed: ${reason}`);
          report.skipped.push({ repo, issueNumber: issue.number, reason });
        }
      }
    }
    return report;
  }

  private async solve(repo: RepoTarget, issue: IssueSummary): Promise<SolvedBounty | null> {
    const branch = branchForIssue(issue);
    const existing = await this.deps.github.findOpenPullByHead(repo.owner, repo.repo, branch);
    if (existing !== null) {
      return null;
    }

    this.log(`solving #${issue.number} in ${repo.owner}/${repo.repo}: ${issue.title}`);
    const info = await this.deps.github.getRepoInfo(repo.owner, repo.repo);
    const dir = await this.deps.workspace.prepare(info.cloneUrl, `${repo.owner}-${repo.repo}`);
    const files = await (this.deps.collectContext ?? collectRepoContext)(dir);

    const fix = await this.deps.generator.generateFix({ repo, issue, files });
    await this.deps.workspace.applyFix(dir, fix.files);
    await this.deps.workspace.commitAndPush(dir, {
      branch,
      message: `fix: ${issue.title} (#${issue.number})`,
      authorName: this.config.gitUserName,
      authorEmail: this.config.gitUserEmail,
    });

    const pr = await this.deps.github.createPullRequest(repo.owner, repo.repo, {
      title: fix.prTitle,
      body: await this.buildPrBody(issue, fix),
      head: branch,
      base: info.defaultBranch,
    });
    this.log(`opened PR #${pr.number}: ${pr.htmlUrl}`);
    return { repo, issueNumber: issue.number, prNumber: pr.number, prUrl: pr.htmlUrl };
  }

  private async buildPrBody(issue: IssueSummary, fix: GeneratedFix): Promise<string> {
    const lines = [fix.summary, "", `Fixes #${issue.number}`, ""];
    const reward = await this.describeReward(issue);
    if (reward) {
      lines.push(reward);
    }
    if (this.config.payoutAddress) {
      lines.push(`Payout wallet: \`${this.config.payoutAddress}\` (${this.config.network})`);
    }
    lines.push("", "_Opened autonomously by the GitBounty agent._");
    return lines.join("\n");
  }

  /** Quotes the bounty's USD reward in FLR via FTSOv2 at pick-up time. */
  private async describeReward(issue: IssueSummary): Promise<string | null> {
    const usd = parseBountyUsd(issue.labels);
    if (usd === null || !this.deps.price) {
      return null;
    }
    try {
      const quote = await this.deps.price.getQuote(FLR_USD);
      const flr = weiToToken(rewardInTokenWei(usd, quote));
      const price = Number(quote.value) / 10 ** quote.decimals;
      return `Bounty: $${usd} ≈ ${flr} FLR (FTSOv2 FLR/USD @ $${price} on ${this.config.network})`;
    } catch {
      return `Bounty: $${usd}`;
    }
  }

  private log(message: string): void {
    this.deps.log?.(message);
  }
}
