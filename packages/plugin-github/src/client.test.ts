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

describe("issue and pull request operations (mocked API)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists open bounty issues and filters out pull requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          { number: 7, title: "Fix login", body: "Steps...", labels: [{ name: "bounty" }] },
          { number: 8, title: "A PR", body: "", labels: [], pull_request: {} },
          { number: 9, title: "No body", body: null, labels: [{ name: "bounty" }] },
        ]),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const issues = await new GitHubClient().listOpenIssues("acme", "demo", "bounty");
    expect(issues.map((i) => i.number)).toEqual([7, 9]);
    expect(issues[1]?.body).toBe("");
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/repos/acme/demo/issues?state=open&labels=bounty");
  });

  it("reads repository metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            default_branch: "main",
            clone_url: "https://github.com/acme/demo.git",
          }),
          { status: 200 },
        ),
      ),
    );

    const info = await new GitHubClient().getRepoInfo("acme", "demo");
    expect(info).toEqual({
      defaultBranch: "main",
      cloneUrl: "https://github.com/acme/demo.git",
    });
  });

  it("finds an existing open PR by head branch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify([{ number: 12 }]), { status: 200 })),
    );
    const num = await new GitHubClient().findOpenPullByHead("acme", "demo", "gitbounty/issue-7");
    expect(num).toBe(12);
  });

  it("returns null when no PR exists for the head branch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })),
    );
    const num = await new GitHubClient().findOpenPullByHead("acme", "demo", "gitbounty/issue-7");
    expect(num).toBeNull();
  });

  it("creates a pull request via POST with json body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ number: 21, html_url: "https://github.com/acme/demo/pull/21" }),
          { status: 201 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const pr = await new GitHubClient("tok").createPullRequest("acme", "demo", {
      title: "Fix login",
      body: "Fixes #7",
      head: "gitbounty/issue-7",
      base: "main",
    });

    expect(pr).toEqual({ number: 21, htmlUrl: "https://github.com/acme/demo/pull/21" });
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { method: string; body: string; headers: Record<string, string> },
    ];
    expect(url).toBe("https://api.github.com/repos/acme/demo/pulls");
    expect(init.method).toBe("POST");
    expect(init.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toMatchObject({ head: "gitbounty/issue-7", base: "main" });
  });
});
