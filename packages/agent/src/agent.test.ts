import type { PriceProvider } from "@gitbounty/core";
import { describe, expect, it, vi } from "vitest";
import { BountyAgent, branchForIssue, parseBountyUsd } from "./agent.js";
import type { AgentConfig } from "./config.js";
import type { FixGenerator, GitHubPort, WorkspacePort } from "./types.js";

const config: AgentConfig = {
  githubToken: "tok",
  repos: [{ owner: "acme", repo: "demo" }],
  bountyLabel: "bounty",
  network: "coston2",
  payoutAddress: "0xa9en7",
  workdir: "/tmp/gitbounty-test",
  gitUserName: "gitbounty-agent",
  gitUserEmail: "agent@gitbounty.dev",
};

const issue = {
  number: 7,
  title: "Login broken",
  body: "Fails on Safari",
  labels: ["bounty", "bounty:$50"],
};

const fix = {
  summary: "Handle the Safari quirk.",
  prTitle: "fix: safari login",
  files: [{ path: "src/login.ts", content: "fixed" }],
};

function makeDeps(overrides: { existingPr?: number | null } = {}) {
  const github: GitHubPort = {
    listOpenIssues: vi.fn().mockResolvedValue([issue]),
    getRepoInfo: vi.fn().mockResolvedValue({
      defaultBranch: "main",
      cloneUrl: "https://github.com/acme/demo.git",
    }),
    findOpenPullByHead: vi.fn().mockResolvedValue(overrides.existingPr ?? null),
    createPullRequest: vi.fn().mockResolvedValue({
      number: 21,
      htmlUrl: "https://github.com/acme/demo/pull/21",
    }),
  };
  const workspace: WorkspacePort = {
    prepare: vi.fn().mockResolvedValue("/tmp/gitbounty-test/acme-demo"),
    applyFix: vi.fn().mockResolvedValue(undefined),
    commitAndPush: vi.fn().mockResolvedValue(undefined),
  };
  const generator: FixGenerator = { generateFix: vi.fn().mockResolvedValue(fix) };
  const price: PriceProvider = {
    getQuote: vi.fn().mockResolvedValue({
      feedId: "0x01464c522f55534400000000000000000000000000",
      value: 2_000_000n, // $0.02 per FLR at 8 decimals
      decimals: 8,
      timestamp: 1_753_000_000,
    }),
  };
  return { github, workspace, generator, price, collectContext: vi.fn().mockResolvedValue([]) };
}

describe("parseBountyUsd", () => {
  it("parses bounty amount labels", () => {
    expect(parseBountyUsd(["bounty", "bounty:$50"])).toBe(50);
    expect(parseBountyUsd(["Bounty: 12.5"])).toBe(12.5);
  });

  it("returns null without an amount label", () => {
    expect(parseBountyUsd(["bounty", "bug"])).toBeNull();
  });
});

describe("BountyAgent end-to-end (faked ports)", () => {
  it("solves a bounty: clone, fix, push, PR with Fixes #N and FLR quote", async () => {
    const deps = makeDeps();
    const report = await new BountyAgent(config, deps).runOnce();

    expect(report.solved).toHaveLength(1);
    expect(report.solved[0]).toMatchObject({ issueNumber: 7, prNumber: 21 });

    expect(deps.workspace.applyFix).toHaveBeenCalledWith(
      "/tmp/gitbounty-test/acme-demo",
      fix.files,
    );
    expect(deps.workspace.commitAndPush).toHaveBeenCalledWith(
      "/tmp/gitbounty-test/acme-demo",
      expect.objectContaining({ branch: "gitbounty/issue-7" }),
    );

    const prCall = vi.mocked(deps.github.createPullRequest).mock.calls[0];
    const [, , prParams] = prCall as [string, string, { body: string; base: string }];
    expect(prParams.base).toBe("main");
    expect(prParams.body).toContain("Fixes #7");
    // $50 at $0.02/FLR = 2500 FLR, quoted via the FTSO price provider
    expect(prParams.body).toContain("2500 FLR");
    expect(prParams.body).toContain("Payout wallet");
  });

  it("skips issues that already have an open agent PR", async () => {
    const deps = makeDeps({ existingPr: 12 });
    const report = await new BountyAgent(config, deps).runOnce();

    expect(report.solved).toHaveLength(0);
    expect(report.skipped[0]?.reason).toBe("pr already open");
    expect(deps.generator.generateFix).not.toHaveBeenCalled();
  });

  // Regression: one failing issue must not abort the whole run.
  it("records a failure and continues the run", async () => {
    const deps = makeDeps();
    vi.mocked(deps.generator.generateFix).mockRejectedValue(new Error("refused"));

    const report = await new BountyAgent(config, deps).runOnce();
    expect(report.solved).toHaveLength(0);
    expect(report.skipped[0]?.reason).toBe("refused");
  });
});

describe("branchForIssue", () => {
  it("derives a deterministic branch name", () => {
    expect(branchForIssue(issue)).toBe("gitbounty/issue-7");
  });
});
