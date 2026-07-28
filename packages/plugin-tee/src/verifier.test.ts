import type { Bounty } from "@gitbounty/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PayoutSigner } from "./signer.js";
import { TeeVerifier } from "./verifier.js";

const KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const ESCROW = "0xa8adefe2c8f0f71a585a73c1259997f593f9e463" as const;

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
const RECIPIENT = "0x3B4f0135465d444a5bD06Ab90fC59B73916C85F5" as const;

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
    new TeeVerifier({
      githubToken: "enclave-held-token",
      signer: new PayoutSigner(KEY, 114, ESCROW),
    });

  it("authorizes payout for a merged PR that closes the bounty issue", async () => {
    stubPr({});
    const result = await verifier().verify(bounty, pullRequest, RECIPIENT);

    expect(result.merged).toBe(true);
    expect(result.payoutAddress).toBe(RECIPIENT);
    expect(result.proof).toMatch(/^0x[0-9a-f]{130}$/);
    expect(result.bounty.id).toBe(bounty.id);
    expect(result.pullRequest).toEqual(pullRequest);
  });

  it("refuses an unmerged PR", async () => {
    stubPr({ merged: false });
    await expect(verifier().verify(bounty, pullRequest, RECIPIENT)).rejects.toThrow(/not merged/);
  });

  // Regression: a merged PR that closes a DIFFERENT issue must not drain the escrow.
  it("refuses a merged PR that does not close the bounty issue", async () => {
    stubPr({ body: "Fixes #99" });
    await expect(verifier().verify(bounty, pullRequest, RECIPIENT)).rejects.toThrow(
      /does not close issue #42/,
    );
  });
});
