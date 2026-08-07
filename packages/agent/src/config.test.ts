import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const baseEnv = {
  GITBOUNTY_GITHUB_TOKEN: "ghp_test",
  GITBOUNTY_REPOS: "acme/demo, flare/example",
};

describe("loadConfig", () => {
  it("parses repos and applies defaults", () => {
    const config = loadConfig(baseEnv);
    expect(config.repos).toEqual([
      { owner: "acme", repo: "demo" },
      { owner: "flare", repo: "example" },
    ]);
    expect(config.bountyLabel).toBe("bounty");
    expect(config.network).toBe("coston2");
    expect(config.gitUserName).toBe("gitbounty-agent");
  });

  it("falls back to GITHUB_TOKEN", () => {
    const config = loadConfig({ ...baseEnv, GITBOUNTY_GITHUB_TOKEN: undefined, GITHUB_TOKEN: "t" });
    expect(config.githubToken).toBe("t");
  });

  it("requires a github token", () => {
    expect(() => loadConfig({ GITBOUNTY_REPOS: "a/b" })).toThrow(/GITBOUNTY_GITHUB_TOKEN/);
  });

  it("requires repos and rejects malformed entries", () => {
    expect(() => loadConfig({ GITBOUNTY_GITHUB_TOKEN: "t" })).toThrow(/GITBOUNTY_REPOS/);
    expect(() => loadConfig({ ...baseEnv, GITBOUNTY_REPOS: "not-a-repo" })).toThrow(
      /invalid GITBOUNTY_REPOS entry/,
    );
  });

  it("rejects unknown networks", () => {
    expect(() => loadConfig({ ...baseEnv, GITBOUNTY_NETWORK: "mainnet" })).toThrow(
      /invalid GITBOUNTY_NETWORK/,
    );
  });
});
