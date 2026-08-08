import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { CommitOptions, WorkspacePort } from "./types.js";

const execFileAsync = promisify(execFile);

function assertInside(rootDir: string, candidate: string, relPath: string): void {
  if (candidate !== rootDir && !candidate.startsWith(rootDir + path.sep)) {
    throw new Error(`refusing to write outside the repository: ${relPath}`);
  }
}

/** Resolves a repo-relative path, refusing anything that escapes the root. */
export function resolveInsideRoot(rootDir: string, relPath: string): string {
  const resolved = path.resolve(rootDir, relPath);
  assertInside(rootDir, resolved, relPath);
  return resolved;
}

/**
 * Same, but proof against symlinks — creating the parent directory first so it
 * can be resolved, and returning a path safe to write.
 *
 * The lexical check above compares strings, and a clone is untrusted content: a
 * repository can ship `docs -> /root`, at which point `docs/x` passes every
 * string test and lands outside anyway. The paths come from a model reading
 * that same repository's issues, so this is reachable, and the agent writes
 * while holding a GitHub token.
 */
export async function resolveWritePath(rootDir: string, relPath: string): Promise<string> {
  const root = await fs.realpath(rootDir);
  const resolved = resolveInsideRoot(root, relPath);

  const parent = path.dirname(resolved);
  await fs.mkdir(parent, { recursive: true });
  assertInside(root, await fs.realpath(parent), relPath);

  // A symlinked *file* has a parent inside the repo, so check the leaf too.
  const target = path.join(await fs.realpath(parent), path.basename(resolved));
  const existing = await fs.lstat(target).catch(() => null);
  if (existing?.isSymbolicLink()) {
    throw new Error(`refusing to write through a symlink: ${relPath}`);
  }
  return target;
}

/** Embeds an access token into an https clone URL. */
export function authenticatedUrl(cloneUrl: string, token: string): string {
  const url = new URL(cloneUrl);
  url.username = "x-access-token";
  url.password = token;
  return url.toString();
}

/** Git operations for the agent's clones, confined to a working directory. */
export class Workspace implements WorkspacePort {
  constructor(
    private readonly rootDir: string,
    private readonly token: string,
  ) {}

  /** Clones (shallow) a repository into a fresh directory and returns its path. */
  async prepare(cloneUrl: string, name: string): Promise<string> {
    const dir = resolveInsideRoot(this.rootDir, name);
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(this.rootDir, { recursive: true });
    await execFileAsync("git", [
      "clone",
      "--depth",
      "1",
      authenticatedUrl(cloneUrl, this.token),
      dir,
    ]);
    return dir;
  }

  /** Writes generated files into the clone, enforcing the repo boundary. */
  async applyFix(repoDir: string, files: { path: string; content: string }[]): Promise<void> {
    for (const file of files) {
      await fs.writeFile(await resolveWritePath(repoDir, file.path), file.content, "utf8");
    }
  }

  /** Creates a branch, commits all changes, and pushes it. */
  async commitAndPush(repoDir: string, options: CommitOptions): Promise<void> {
    const git = (...args: string[]) => execFileAsync("git", ["-C", repoDir, ...args]);
    await git("checkout", "-b", options.branch);
    await git("add", "--all");
    await git(
      "-c",
      `user.name=${options.authorName}`,
      "-c",
      `user.email=${options.authorEmail}`,
      "commit",
      "--message",
      options.message,
    );
    await git("push", "origin", options.branch);
  }
}
