import type { PullRequestRef } from "@gitbounty/core";

/** Merge state of a pull request as reported by the GitHub REST API. */
export interface PullRequestState {
  merged: boolean;
  authorLogin: string;
  mergedAt: string | null;
  /** Issue numbers this PR closes via closing keywords. */
  closesIssues: number[];
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

  private async get<T>(path: string): Promise<T> {
    const headers: Record<string, string> = {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    };
    if (this.token) {
      headers.authorization = `Bearer ${this.token}`;
    }
    const res = await fetch(`${API_BASE}${path}`, { headers });
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
