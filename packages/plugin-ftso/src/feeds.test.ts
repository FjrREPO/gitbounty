import { describe, expect, it } from "vitest";
import { encodeFeedId, FLR_USD } from "./feeds.js";

describe("encodeFeedId", () => {
  // Regression: this exact id returns live data from FtsoV2 on coston2.
  it("encodes FLR/USD to the canonical 21-byte id", () => {
    expect(FLR_USD).toBe("0x01464c522f55534400000000000000000000000000");
  });

  it("always produces 21 bytes (category + 20 name bytes)", () => {
    for (const name of ["BTC/USD", "ETH/USD", "XRP/USD", "A"]) {
      expect(encodeFeedId(name)).toHaveLength(2 + 21 * 2);
    }
  });

  it("supports a custom category byte", () => {
    expect(encodeFeedId("BTC/USD", 0x02).startsWith("0x02")).toBe(true);
  });

  it("rejects names longer than 20 bytes", () => {
    expect(() => encodeFeedId("THIS/FEEDNAMEISTOOLONG")).toThrow(/too long/);
  });
});
