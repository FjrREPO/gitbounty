"use client";

import { useQuery } from "@tanstack/react-query";
import ky from "ky";

/** Avatar without touching the rate-limited API. */
export function avatarUrl(owner: string, size = 96): string {
  return `https://github.com/${owner}.png?size=${size}`;
}

export interface RepoInfo {
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  openIssues: number;
  pushedAt: string;
}

export interface IssueInfo {
  title: string;
  state: "open" | "closed";
  comments: number;
  labels: { name: string; color: string }[];
  authorLogin: string;
  body: string | null;
}

export interface PullInfo {
  title: string;
  state: string;
  merged: boolean;
  authorLogin: string;
  additions: number;
  deletions: number;
  changedFiles: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Unauthenticated on purpose: anything NEXT_PUBLIC_ ships inside the client
// bundle, so a token here would be readable by every visitor. The API above is
// the authenticated path; this direct fallback only runs when it is unreachable
// and GitHub's 60/hour anonymous budget is enough for that.
const gh = ky.create({
  prefixUrl: "https://api.github.com",
  headers: {
    accept: "application/vnd.github+json",
  },
  retry: 0,
  timeout: 10_000,
});

/**
 * Repo metadata (stars, forks, language). Cached long and deduped per repo
 * so the unauthenticated 60 req/h GitHub limit survives a busy list page.
 */
interface ApiMeta {
  repo: {
    description: string | null;
    language: string | null;
    stars: number;
    forks: number;
    openIssues: number;
    commits: number;
    pullRequests: number;
    pushedAt: string;
  } | null;
  issue: {
    title: string;
    state: "open" | "closed";
    comments: number;
    labels: { name: string; color: string }[];
    authorLogin: string;
  } | null;
  contributors: { login: string; avatarUrl: string; contributions: number }[];
}

/** Cached metadata from our own API (no browser-side GitHub rate limit). */
function useApiMeta(repo: string, issueNumber?: string) {
  return useQuery({
    queryKey: ["api-meta", repo, issueNumber ?? ""],
    queryFn: async (): Promise<ApiMeta> =>
      ky
        .get(`${API_URL}/api/v1/github`, {
          searchParams: {
            repo,
            ...(issueNumber ? { issue: issueNumber } : {}),
          },
          retry: 0,
        })
        .json<ApiMeta>(),
    enabled: Boolean(API_URL),
    staleTime: 60_000,
    retry: false,
  });
}

export function useRepoInfo(repo: string) {
  const apiMeta = useApiMeta(repo);
  const direct = useQuery({
    queryKey: ["gh-repo", repo],
    enabled: !API_URL,
    queryFn: async (): Promise<RepoInfo> => {
      const data = await gh.get(`repos/${repo}`).json<{
        description: string | null;
        stargazers_count: number;
        forks_count: number;
        language: string | null;
        open_issues_count: number;
        pushed_at: string;
      }>();
      return {
        description: data.description,
        stars: data.stargazers_count,
        forks: data.forks_count,
        language: data.language,
        openIssues: data.open_issues_count,
        pushedAt: data.pushed_at,
      };
    },
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
  });

  if (API_URL) {
    return {
      data: apiMeta.data?.repo
        ? {
            description: apiMeta.data.repo.description,
            stars: apiMeta.data.repo.stars,
            forks: apiMeta.data.repo.forks,
            language: apiMeta.data.repo.language || null,
            openIssues: apiMeta.data.repo.openIssues,
            pushedAt: apiMeta.data.repo.pushedAt,
          }
        : undefined,
      isLoading: apiMeta.isLoading,
      isError: apiMeta.isError,
    };
  }
  return direct;
}

/** Issue title, labels, and state for a bounty. */
export function useIssueInfo(repo: string, issueNumber: string) {
  const apiMeta = useApiMeta(repo, issueNumber);
  const direct = useQuery({
    queryKey: ["gh-issue", repo, issueNumber],
    enabled: !API_URL,
    queryFn: async (): Promise<IssueInfo> => {
      const data = await gh.get(`repos/${repo}/issues/${issueNumber}`).json<{
        title: string;
        state: "open" | "closed";
        comments: number;
        labels: { name: string; color: string }[];
        user: { login: string } | null;
        body: string | null;
      }>();
      return {
        title: data.title,
        state: data.state,
        comments: data.comments,
        labels: data.labels,
        authorLogin: data.user?.login ?? "",
        body: data.body,
      };
    },
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
  });

  if (API_URL) {
    return {
      data: apiMeta.data?.issue ? { ...apiMeta.data.issue, body: null } : undefined,
      isLoading: apiMeta.isLoading,
      isError: apiMeta.isError,
    };
  }
  return direct;
}

/** PR stats for a registered claim (fetched only on the detail page). */
export function usePullInfo(repo: string, prNumber: string) {
  return useQuery({
    queryKey: ["gh-pull", repo, prNumber],
    queryFn: async (): Promise<PullInfo> => {
      const data = await gh.get(`repos/${repo}/pulls/${prNumber}`).json<{
        title: string;
        state: string;
        merged: boolean;
        user: { login: string } | null;
        additions: number;
        deletions: number;
        changed_files: number;
      }>();
      return {
        title: data.title,
        state: data.state,
        merged: data.merged,
        authorLogin: data.user?.login ?? "",
        additions: data.additions,
        deletions: data.deletions,
        changedFiles: data.changed_files,
      };
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export interface Contributor {
  login: string;
  avatarUrl: string;
  contributions: number;
}

/** Top contributors of the repo (max 8). */
export function useContributors(repo: string) {
  const apiMeta = useApiMeta(repo);
  const direct = useQuery({
    queryKey: ["gh-contributors", repo],
    enabled: !API_URL,
    queryFn: async (): Promise<Contributor[]> => {
      const data = await gh
        .get(`repos/${repo}/contributors`, {
          searchParams: { per_page: 8 },
        })
        .json<{ login: string; avatar_url: string; contributions: number }[]>();
      return data.map((c) => ({
        login: c.login,
        avatarUrl: c.avatar_url,
        contributions: c.contributions,
      }));
    },
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
  });

  if (API_URL) {
    return {
      data: apiMeta.data?.contributors,
      isLoading: apiMeta.isLoading,
      isError: apiMeta.isError,
    };
  }
  return direct;
}

/** Total item count of a paginated endpoint, read from the Link header. */
async function countViaLastPage(
  path: string,
  searchParams: Record<string, string>,
): Promise<number> {
  const res = await gh.get(path, {
    searchParams: { ...searchParams, per_page: "1" },
  });
  const link = res.headers.get("link");
  if (link) {
    const match = link.match(/[?&]page=(\d+)>; rel="last"/);
    if (match?.[1]) {
      return Number(match[1]);
    }
  }
  const items = await res.json<unknown[]>();
  return items.length;
}

export interface RepoActivity {
  commits: number;
  pullRequests: number;
}

/** Commit and PR totals via the Link-header pagination trick (2 requests). */
export function useRepoActivity(repo: string) {
  const apiMeta = useApiMeta(repo);
  const direct = useQuery({
    queryKey: ["gh-activity", repo],
    enabled: !API_URL,
    queryFn: async (): Promise<RepoActivity> => {
      const [commits, pullRequests] = await Promise.all([
        countViaLastPage(`repos/${repo}/commits`, {}),
        countViaLastPage(`repos/${repo}/pulls`, { state: "all" }),
      ]);
      return { commits, pullRequests };
    },
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
  });

  if (API_URL) {
    return {
      data: apiMeta.data?.repo
        ? {
            commits: apiMeta.data.repo.commits,
            pullRequests: apiMeta.data.repo.pullRequests,
          }
        : undefined,
      isLoading: apiMeta.isLoading,
      isError: apiMeta.isError,
    };
  }
  return direct;
}

/** GitHub's language dot colors for the common languages. */
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  Solidity: "#AA6746",
  Java: "#b07219",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  Ruby: "#701516",
  PHP: "#4F5D95",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  HTML: "#e34c26",
  CSS: "#663399",
  Shell: "#89e051",
  Vue: "#41b883",
  Dart: "#00B4AB",
};

export function languageColor(language: string | null): string {
  return (language && LANGUAGE_COLORS[language]) || "#8b949e";
}
