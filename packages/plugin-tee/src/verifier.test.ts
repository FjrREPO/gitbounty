import type { Bounty } from "@gitbounty/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TeeVerifier } from "./verifier.js";

const bounty: Bounty = {
  id: "0x01",
  issue: { owner: "acme", repo: "private-api", issueNumber: 42, isPrivate: true },
  rewardUsd: 250,
  funder: "0xf00d",
  status: "verifying",
  mode: "tee",
  createdAt: 1_700_000_000,
  expiresAt: 1_800_000_000,
};

const pullRequest = { owner: "acme", repo: "private-api", prNumber: 7 };

const stubPr = (overrides: Record<string, unknown>) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          merged: true,
          merged_at: "2026-07-28T10:00:00Z",
          user: { login: "anon-dev" },
          body: "Fixes #42",
          ...overrides,
        }),
        { status: 200 },
      ),
    ),
  );
};

describe("TeeVerifier end-to-end (mocked GitHub)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const verifier = () =>
    new TeeVerifier({ githubToken: "enclave-held-token", payoutAddress: "0xabc123" });

  it("authorizes payout for a merged PR that closes the bounty issue", async () => {
    stubPr({});
    const result = await verifier().verify(bounty, pullRequest);

    expect(result.merged).toBe(true);
    expect(result.payoutAddress).toBe("0xabc123");
    expect(result.bounty.id).toBe(bounty.id);
    expect(result.pullRequest).toEqual(pullRequest);
  });

  it("refuses an unmerged PR", async () => {
    stubPr({ merged: false });
    await expect(verifier().verify(bounty, pullRequest)).rejects.toThrow(/not merged/);
  });

  // Regression: a merged PR that closes a DIFFERENT issue must not drain the escrow.
  it("refuses a merged PR that does not close the bounty issue", async () => {
    stubPr({ body: "Fixes #99" });
    await expect(verifier().verify(bounty, pullRequest)).rejects.toThrow(
      /does not close issue #42/,
    );
  });
});
