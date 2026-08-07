import { describe, expect, it } from "vitest";
import type { FixTask } from "../types.js";
import { buildFixPrompt, parseGeneratedFix } from "./prompt.js";

const task: FixTask = {
  repo: { owner: "acme", repo: "demo" },
  issue: { number: 7, title: "Login broken on Safari", body: "It throws.", labels: ["bounty"] },
  files: [{ path: "src/login.ts", content: "export const login = () => {};" }],
};

describe("buildFixPrompt", () => {
  it("includes the issue, repo, and file contents", () => {
    const prompt = buildFixPrompt(task);
    expect(prompt).toContain("acme/demo");
    expect(prompt).toContain("Issue #7: Login broken on Safari");
    expect(prompt).toContain("It throws.");
    expect(prompt).toContain("### src/login.ts");
    expect(prompt).toContain("export const login");
  });

  it("marks an empty issue body explicitly", () => {
    const prompt = buildFixPrompt({ ...task, issue: { ...task.issue, body: "" } });
    expect(prompt).toContain("(no issue body)");
  });
});

describe("parseGeneratedFix", () => {
  const valid = {
    summary: "Fixed the login handler.",
    prTitle: "fix: handle Safari login",
    files: [{ path: "src/login.ts", content: "export const login = () => true;" }],
  };

  it("accepts a well-formed fix", () => {
    expect(parseGeneratedFix(JSON.stringify(valid))).toEqual(valid);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseGeneratedFix("not json")).toThrow(/invalid JSON/);
  });

  // Regression: an empty fix must never proceed to a commit and PR.
  it("rejects a fix with no files", () => {
    expect(() => parseGeneratedFix(JSON.stringify({ ...valid, files: [] }))).toThrow(
      /unexpected shape/,
    );
  });

  it("rejects malformed file entries", () => {
    expect(() =>
      parseGeneratedFix(JSON.stringify({ ...valid, files: [{ path: 1, content: "x" }] })),
    ).toThrow(/unexpected shape/);
  });
});
