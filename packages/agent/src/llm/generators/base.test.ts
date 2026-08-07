import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import type { FixTask } from "../../types.js";
import { BaseFixGenerator } from "./base.js";

const task: FixTask = {
  repo: { owner: "acme", repo: "demo" },
  issue: { number: 7, title: "Login broken", body: "It throws.", labels: ["bounty"] },
  files: [{ path: "src/login.ts", content: "export const login = () => {};" }],
};

const fix = {
  summary: "Fixed.",
  prTitle: "fix: login",
  files: [{ path: "src/login.ts", content: "export const login = () => true;" }],
};

function clientReturning(message: Record<string, unknown>): OpenAI {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({ choices: [{ message }] }),
      },
    },
  } as unknown as OpenAI;
}

describe("BaseFixGenerator", () => {
  it("parses a structured completion", async () => {
    const generator = new BaseFixGenerator({
      model: "gpt-test",
      client: clientReturning({ content: JSON.stringify(fix), refusal: null }),
    });
    await expect(generator.generateFix(task)).resolves.toEqual(fix);
  });

  it("throws on a refusal", async () => {
    const generator = new BaseFixGenerator({
      model: "gpt-test",
      client: clientReturning({ content: null, refusal: "cannot comply" }),
    });
    await expect(generator.generateFix(task)).rejects.toThrow(/refused/);
  });

  it("throws on an empty completion", async () => {
    const generator = new BaseFixGenerator({
      model: "gpt-test",
      client: clientReturning({ content: null, refusal: null }),
    });
    await expect(generator.generateFix(task)).rejects.toThrow(/no content/);
  });
});

describe("BaseFixGenerator base", () => {
  it("requires a model", () => {
    expect(() => new BaseFixGenerator({ apiKey: "k" })).toThrow(/model is required/);
  });
});
