import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authenticatedUrl, resolveInsideRoot, resolveWritePath } from "./workspace.js";

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

describe("resolveWritePath", () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "gitbounty-ws-"));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("resolves an ordinary path and creates its parent", async () => {
    const target = await resolveWritePath(root, "src/deep/file.ts");
    expect(target.startsWith(await fs.realpath(root))).toBe(true);
    await expect(fs.stat(path.dirname(target))).resolves.toBeDefined();
  });

  // Regression: a clone is untrusted content. A repository shipping
  // `docs -> /elsewhere` made every string-based check pass while the write
  // landed outside the repo entirely.
  it("refuses a directory symlink that escapes the repo", async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "gitbounty-out-"));
    await fs.symlink(outside, path.join(root, "docs"));
    await expect(resolveWritePath(root, "docs/pwned.txt")).rejects.toThrow(
      /outside the repository/,
    );
    await fs.rm(outside, { recursive: true, force: true });
  });

  it("refuses a symlinked file, whose parent is legitimately inside", async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "gitbounty-out-"));
    const victim = path.join(outside, "secrets");
    await fs.writeFile(victim, "before");
    await fs.symlink(victim, path.join(root, "README.md"));
    await expect(resolveWritePath(root, "README.md")).rejects.toThrow(/through a symlink/);
    expect(await fs.readFile(victim, "utf8")).toBe("before");
    await fs.rm(outside, { recursive: true, force: true });
  });

  it("still refuses plain traversal", async () => {
    await expect(resolveWritePath(root, "../escape.txt")).rejects.toThrow(/outside the repository/);
  });
});
