import { describe, expect, it } from "vitest";
import { loadVerifierConfig } from "./config.js";

const base = {
  GITHUB_TOKEN: "ghp_x",
  ESCROW_ADDRESS: "0xa8adefe2c8f0f71a585a73c1259997f593f9e463",
};

describe("loadVerifierConfig", () => {
  // The whole confidentiality claim rests on this: with no key supplied, the
  // enclave mints its own, so no operator can sign payouts.
  it("generates a signing key when none is injected", () => {
    const a = loadVerifierConfig(base);
    const b = loadVerifierConfig(base);
    expect(a.signingKey).toMatch(/^0x[0-9a-f]{64}$/);
    expect(a.keyWasInjected).toBe(false);
    expect(a.signingKey).not.toBe(b.signingKey);
  });

  it("accepts an injected key but flags it", () => {
    const key = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
    const cfg = loadVerifierConfig({ ...base, TEE_SIGNING_KEY: key });
    expect(cfg.signingKey).toBe(key);
    expect(cfg.keyWasInjected).toBe(true);
  });

  it("rejects a malformed injected key and missing inputs", () => {
    expect(() => loadVerifierConfig({ ...base, TEE_SIGNING_KEY: "0xdead" })).toThrow(/32-byte/);
    expect(() => loadVerifierConfig({ GITHUB_TOKEN: "x" })).toThrow(/ESCROW_ADDRESS/);
    expect(() => loadVerifierConfig({ ESCROW_ADDRESS: base.ESCROW_ADDRESS })).toThrow(
      /GITHUB_TOKEN/,
    );
  });
});
