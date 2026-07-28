import { describe, expect, it } from "vitest";
import { isTextCandidate } from "./context.js";

describe("isTextCandidate", () => {
  it("accepts source and config files", () => {
    for (const p of ["src/index.ts", "README.md", "biome.json", "Dockerfile"]) {
      expect(isTextCandidate(p)).toBe(true);
    }
  });

  it("rejects binaries and lockfiles", () => {
    for (const p of ["logo.png", "font.woff2", "pnpm-lock.yaml", "docs/spec.pdf"]) {
      expect(isTextCandidate(p)).toBe(false);
    }
  });
});
