import type { PullRequestRef } from "@gitbounty/core";

/** Merge state of a pull request as reported by the GitHub REST API. */
export interface PullRequestState {
  merged: boolean;
  authorLogin: string;
  mergedAt: string | null;
  /** Issue numbers this PR closes via closing keywords. */
  closesIssues: number[];
}

/** An open issue eligible for a bounty. */
export interface IssueSummary {
  number: number;
  title: string;
  body: string;
  labels: string[];
}

/** Repository metadata needed to clone and target pull requests. */
export interface RepoInfo {
  defaultBranch: string;
  cloneUrl: string;
}

/** A pull request created by the agent. */
export interface CreatedPullRequest {
  number: number;
  htmlUrl: string;
}

const API_BASE = "https://api.github.com";

const CLOSING_KEYWORDS =
  /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+(?:[\w.-]+\/[\w.-]+)?#(\d+)/gi;

/**
 * Minimal GitHub REST client. In the TEE verification path this runs inside
 * the enclave, so the token never leaves confidential memory.
 */
export class GitHubClient {
  constructor(private readonly token?: string) {}

  /** Fetches the authoritative merge state of a pull request. */
  async getPullRequestState(ref: PullRequestRef): Promise<PullRequestState> {
    const pr = await this.get<{
      merged: boolean;
      merged_at: string | null;
      user: { login: string } | null;
      body: string | null;
    }>(`/repos/${ref.owner}/${ref.repo}/pulls/${ref.prNumber}`);

    return {
      merged: pr.merged,
      authorLogin: pr.user?.login ?? "",
      mergedAt: pr.merged_at,
      closesIssues: extractClosedIssues(pr.body ?? ""),
    };
  }

  /** Lists open issues carrying the given label. */
  async listOpenIssues(owner: string, repo: string, label: string): Promise<IssueSummary[]> {
    const issues = await this.get<
      {
        number: number;
        title: string;
        body: string | null;
        labels: { name: string }[];
        pull_request?: object;
      }[]
    >(`/repos/${owner}/${repo}/issues?state=open&labels=${encodeURIComponent(label)}`);

    return issues
      .filter((issue) => issue.pull_request === undefined)
      .map((issue) => ({
        number: issue.number,
        title: issue.title,
        body: issue.body ?? "",
        labels: issue.labels.map((l) => l.name),
      }));
  }

  /** Fetches the default branch and clone URL of a repository. */
  async getRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
    const info = await this.get<{ default_branch: string; clone_url: string }>(
      `/repos/${owner}/${repo}`,
    );
    return { defaultBranch: info.default_branch, cloneUrl: info.clone_url };
  }

  /** Returns the number of an open PR from `headBranch`, or null if none exists. */
  async findOpenPullByHead(
    owner: string,
    repo: string,
    headBranch: string,
  ): Promise<number | null> {
    const pulls = await this.get<{ number: number }[]>(
      `/repos/${owner}/${repo}/pulls?state=open&head=${encodeURIComponent(`${owner}:${headBranch}`)}`,
    );
    return pulls[0]?.number ?? null;
  }

  /** Opens a pull request. */
  async createPullRequest(
    owner: string,
    repo: string,
    params: { title: string; body: string; head: string; base: string },
  ): Promise<CreatedPullRequest> {
    const pr = await this.post<{ number: number; html_url: string }>(
      `/repos/${owner}/${repo}/pulls`,
      params,
    );
    return { number: pr.number, htmlUrl: pr.html_url };
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    };
    if (this.token) {
      headers.authorization = `Bearer ${this.token}`;
    }
    if (body !== undefined) {
      headers["content-type"] = "application/json";
    }
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`GitHub API ${path} failed: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  }
}

/** Parses issue numbers referenced with closing keywords in a PR body. */
export function extractClosedIssues(body: string): number[] {
  const issues = new Set<number>();
  for (const match of body.matchAll(CLOSING_KEYWORDS)) {
    const num = match[1];
    if (num !== undefined) {
      issues.add(Number.parseInt(num, 10));
    }
  }
  return [...issues];
}
