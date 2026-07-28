import path from "node:path";
import { describe, expect, it } from "vitest";
import { authenticatedUrl, resolveInsideRoot } from "./workspace.js";

describe("resolveInsideRoot", () => {
  const root = path.resolve("/tmp/gitbounty/agent-work/acme-demo");

  it("resolves paths inside the root", () => {
    expect(resolveInsideRoot(root, "src/login.ts")).toBe(path.join(root, "src/login.ts"));
  });

  // Regression: a malicious fix must not be able to write outside the clone.
  it("rejects path traversal", () => {
    expect(() => resolveInsideRoot(root, "../../../etc/passwd")).toThrow(/outside the repository/);
    expect(() => resolveInsideRoot(root, "src/../../evil.sh")).toThrow(/outside the repository/);
  });

  it("rejects absolute paths outside the root", () => {
    expect(() => resolveInsideRoot(root, "/etc/passwd")).toThrow(/outside the repository/);
  });
});

describe("authenticatedUrl", () => {
  it("embeds the token as basic auth", () => {
    expect(authenticatedUrl("https://github.com/acme/demo.git", "tok123")).toBe(
      "https://x-access-token:tok123@github.com/acme/demo.git",
    );
  });
});
