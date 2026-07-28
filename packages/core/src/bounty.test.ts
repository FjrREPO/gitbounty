import { describe, expect, it } from "vitest";
import { canTransition, isExpired, rewardInTokenWei, transition } from "./bounty.js";
import type { Bounty, PriceQuote } from "./types.js";

const bounty = (status: Bounty["status"]): Bounty => ({
  id: "0x01",
  issue: { owner: "flare", repo: "demo", issueNumber: 42, isPrivate: false },
  rewardUsd: 100,
  funder: "0xf00d",
  status,
  mode: "fdc-web2json",
  createdAt: 1_700_000_000,
  expiresAt: 1_700_100_000,
});

describe("bounty state machine", () => {
  it("allows the happy path open -> claimed -> verifying -> paid", () => {
    let b = bounty("open");
    b = transition(b, "claimed");
    b = transition(b, "verifying");
    b = transition(b, "paid");
    expect(b.status).toBe("paid");
  });

  it("rejects skipping verification", () => {
    expect(() => transition(bounty("open"), "paid")).toThrow(/illegal bounty transition/);
  });

  it("treats terminal states as final", () => {
    for (const terminal of ["paid", "cancelled", "expired"] as const) {
      for (const next of ["open", "claimed", "verifying", "paid"] as const) {
        expect(canTransition(bounty(terminal), next)).toBe(false);
      }
    }
  });

  it("lets a failed verification fall back to claimed", () => {
    expect(canTransition(bounty("verifying"), "claimed")).toBe(true);
  });
});

describe("isExpired", () => {
  it("expires an open bounty past its deadline", () => {
    expect(isExpired(bounty("open"), 1_700_100_000)).toBe(true);
    expect(isExpired(bounty("open"), 1_700_099_999)).toBe(false);
  });

  it("never expires a bounty that is already being paid out", () => {
    expect(isExpired(bounty("verifying"), 2_000_000_000)).toBe(false);
  });
});

describe("rewardInTokenWei", () => {
  const quote = (value: bigint, decimals = 8): PriceQuote => ({
    feedId: "0x01464c522f55534400000000000000000000000000",
    value,
    decimals,
    timestamp: 1_700_000_000,
  });

  it("converts a USD reward at the quoted price", () => {
    // $100 at $0.05/token -> 2000 tokens
    expect(rewardInTokenWei(100, quote(5_000_000n))).toBe(2000n * 10n ** 18n);
  });

  it("handles a $1 price exactly", () => {
    expect(rewardInTokenWei(1, quote(100_000_000n))).toBe(10n ** 18n);
  });

  // Regression: real coston2 FLR/USD quote observed on 2026-07-28.
  it("converts against a live-shaped FTSO quote", () => {
    const wei = rewardInTokenWei(100, quote(623_362n));
    // 100 / 0.00623362 tokens, in wei
    expect(wei).toBe((100n * 10n ** 8n * 10n ** 18n) / 623_362n);
  });

  it("rejects a zero or negative quote", () => {
    expect(() => rewardInTokenWei(100, quote(0n))).toThrow(/invalid FTSO quote/);
    expect(() => rewardInTokenWei(100, quote(-1n))).toThrow(/invalid FTSO quote/);
  });
});
