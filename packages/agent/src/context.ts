import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { RepoFile } from "./types.js";

const execFileAsync = promisify(execFile);

const SKIPPED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".woff",
  ".woff2",
  ".ttf",
  ".lock",
  ".lockb",
]);

const SKIPPED_FILES = new Set(["pnpm-lock.yaml", "package-lock.json", "yarn.lock"]);

export interface ContextBudget {
  /** Skip individual files larger than this. */
  maxFileBytes: number;
  /** Stop collecting once this much content has been gathered. */
  maxTotalBytes: number;
}

const DEFAULT_BUDGET: ContextBudget = {
  maxFileBytes: 48 * 1024,
  maxTotalBytes: 192 * 1024,
};

/**
 * Collects the tracked text files of a cloned repository, smallest-path
 * first, within a byte budget. Demo-scale repos fit entirely; larger repos
 * degrade gracefully instead of blowing up the prompt.
 */
export async function collectRepoContext(
  repoDir: string,
  budget: ContextBudget = DEFAULT_BUDGET,
): Promise<RepoFile[]> {
  const { stdout } = await execFileAsync("git", ["-C", repoDir, "ls-files"]);
  const paths = stdout.split("\n").filter(Boolean).filter(isTextCandidate);

  const files: RepoFile[] = [];
  let total = 0;
  for (const relPath of paths) {
    const absPath = path.join(repoDir, relPath);
    const stat = await fs.stat(absPath).catch(() => null);
    if (!stat?.isFile() || stat.size > budget.maxFileBytes) {
      continue;
    }
    if (total + stat.size > budget.maxTotalBytes) {
      break;
    }
    total += stat.size;
    files.push({ path: relPath, content: await fs.readFile(absPath, "utf8") });
  }
  return files;
}

export function isTextCandidate(relPath: string): boolean {
  const base = path.basename(relPath);
  return !SKIPPED_FILES.has(base) && !SKIPPED_EXTENSIONS.has(path.extname(base).toLowerCase());
}
