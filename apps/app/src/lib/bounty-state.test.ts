import { describe, expect, it } from "vitest";
import { canReclaim, displayStatus, isExpired } from "./bounty-state";
// Type-only, so the React/query modules subgraph.ts pulls in never load here.
import type { Bounty } from "./subgraph";

const NOW = 1_786_000_000_000;
const bounty = (over: Partial<Bounty> = {}): Bounty =>
  ({
    bountyId: "1",
    funder: "0xAbC0000000000000000000000000000000000001",
    repo: "acme/demo",
    issueNumber: "1",
    amount: "1",
    rewardUsdCents: "0",
    expiresAt: String(Math.floor(NOW / 1000) + 3600),
    status: "OPEN",
    createdAt: "0",
    createdTx: "0x",
    paidTo: null,
    paidAmount: null,
    refundedAmount: null,
    claims: [],
    ...over,
  }) as Bounty;

describe("displayStatus", () => {
  it("leaves settled bounties alone", () => {
    expect(displayStatus(bounty({ status: "PAID" }), "closed", NOW)).toBe("PAID");
    expect(displayStatus(bounty({ status: "RECLAIMED" }), "open", NOW)).toBe("RECLAIMED");
  });

  it("is open only while the deadline and the issue both hold", () => {
    expect(displayStatus(bounty(), "open", NOW)).toBe("OPEN");
    expect(displayStatus(bounty(), undefined, NOW)).toBe("OPEN");
  });

  it("flags a closed issue on a funded bounty", () => {
    expect(displayStatus(bounty(), "closed", NOW)).toBe("STALE");
  });

  // Once the deadline passes nothing can settle, so expiry wins over the issue.
  it("prefers expiry over a closed issue", () => {
    const past = bounty({ expiresAt: String(Math.floor(NOW / 1000) - 1) });
    expect(displayStatus(past, "closed", NOW)).toBe("EXPIRED");
    expect(displayStatus(past, "open", NOW)).toBe("EXPIRED");
  });

  it("treats the exact expiry second as expired", () => {
    expect(isExpired(bounty({ expiresAt: String(Math.floor(NOW / 1000)) }), NOW)).toBe(true);
  });
});

describe("canReclaim", () => {
  const expired = bounty({ expiresAt: String(Math.floor(NOW / 1000) - 1) });

  it("allows the funder once expired, whatever the address casing", () => {
    expect(canReclaim(expired, "0xabc0000000000000000000000000000000000001", NOW)).toBe(true);
  });

  it("refuses everyone else, and the funder before expiry", () => {
    expect(canReclaim(expired, "0x0000000000000000000000000000000000000002", NOW)).toBe(false);
    expect(canReclaim(expired, undefined, NOW)).toBe(false);
    expect(canReclaim(bounty(), expired.funder, NOW)).toBe(false);
  });

  it("refuses a bounty that already settled", () => {
    const paid = bounty({ status: "PAID", expiresAt: expired.expiresAt });
    expect(canReclaim(paid, paid.funder, NOW)).toBe(false);
  });
});
