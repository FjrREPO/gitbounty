import type { CreatedPullRequest, IssueSummary, RepoInfo } from "@gitbounty/plugin-github";

/** A repository the agent watches for bounty issues. */
export interface RepoTarget {
  owner: string;
  repo: string;
}

/** A source file included in the fix-generation context. */
export interface RepoFile {
  path: string;
  content: string;
}

/** Everything the generator needs to produce a fix. */
export interface FixTask {
  repo: RepoTarget;
  issue: IssueSummary;
  files: RepoFile[];
}

/** A complete fix: full new contents for every touched file. */
export interface GeneratedFix {
  summary: string;
  prTitle: string;
  files: { path: string; content: string }[];
}

/**
 * Produces a fix for a bounty issue. The LLM lives behind this interface so
 * the agent loop is testable and the model can be swapped.
 */
export interface FixGenerator {
  generateFix(task: FixTask): Promise<GeneratedFix>;
}

export interface CommitOptions {
  branch: string;
  message: string;
  authorName: string;
  authorEmail: string;
}

/** Git operations the agent needs; implemented by Workspace. */
export interface WorkspacePort {
  prepare(cloneUrl: string, name: string): Promise<string>;
  applyFix(repoDir: string, files: { path: string; content: string }[]): Promise<void>;
  commitAndPush(repoDir: string, options: CommitOptions): Promise<void>;
}

/** GitHub operations the agent needs; implemented by GitHubClient. */
export interface GitHubPort {
  listOpenIssues(owner: string, repo: string, label: string): Promise<IssueSummary[]>;
  getRepoInfo(owner: string, repo: string): Promise<RepoInfo>;
  findOpenPullByHead(owner: string, repo: string, headBranch: string): Promise<number | null>;
  createPullRequest(
    owner: string,
    repo: string,
    params: { title: string; body: string; head: string; base: string },
  ): Promise<CreatedPullRequest>;
}
