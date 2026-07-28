import { afterEach, describe, expect, it, vi } from "vitest";
import { extractClosedIssues, GitHubClient } from "./client.js";

describe("extractClosedIssues", () => {
  it("parses all closing keywords case-insensitively", () => {
    const body = "Fixes #12, closes #7 and RESOLVES #3";
    expect(extractClosedIssues(body).sort((a, b) => a - b)).toEqual([3, 7, 12]);
  });

  it("supports cross-repo references and deduplicates", () => {
    expect(extractClosedIssues("fixes flare/demo#5, fixed #5")).toEqual([5]);
  });

  it("ignores plain mentions without a closing keyword", () => {
    expect(extractClosedIssues("related to #9, see #10")).toEqual([]);
  });

  it("returns empty for an empty body", () => {
    expect(extractClosedIssues("")).toEqual([]);
  });
});

describe("GitHubClient integration (mocked API)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const prResponse = {
    merged: true,
    merged_at: "2026-07-28T10:00:00Z",
    user: { login: "octocat" },
    body: "Fixes #42",
  };

  it("reads merge state, author, and closed issues from the pulls endpoint", () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(prResponse), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new GitHubClient("token-123");
    return client
      .getPullRequestState({ owner: "flare", repo: "demo", prNumber: 1 })
      .then((state) => {
        expect(state).toEqual({
          merged: true,
          authorLogin: "octocat",
          mergedAt: "2026-07-28T10:00:00Z",
          closesIssues: [42],
        });
        const [url, init] = fetchMock.mock.calls[0] as [
          string,
          { headers: Record<string, string> },
        ];
        expect(url).toBe("https://api.github.com/repos/flare/demo/pulls/1");
        expect(init.headers.authorization).toBe("Bearer token-123");
      });
  });

  it("omits the authorization header without a token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(prResponse), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await new GitHubClient().getPullRequestState({ owner: "flare", repo: "demo", prNumber: 1 });
    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(init.headers.authorization).toBeUndefined();
  });

  it("surfaces API failures with status context", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("not found", { status: 404, statusText: "Not Found" })),
    );

    await expect(
      new GitHubClient().getPullRequestState({ owner: "flare", repo: "demo", prNumber: 999 }),
    ).rejects.toThrow(/404 Not Found/);
  });

  it("tolerates a deleted author account", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ ...prResponse, user: null, body: null }), { status: 200 }),
        ),
    );

    const state = await new GitHubClient().getPullRequestState({
      owner: "flare",
      repo: "demo",
      prNumber: 1,
    });
    expect(state.authorLogin).toBe("");
    expect(state.closesIssues).toEqual([]);
  });
});
