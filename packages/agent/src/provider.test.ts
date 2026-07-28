import { describe, expect, it } from "vitest";
import { OpenAICompatibleFixGenerator } from "./generators/base.js";
import { ClaudeFixGenerator } from "./generators/claude.js";
import {
  chooseProvider,
  createGenerator,
  createGeneratorFor,
  listProviders,
  PROVIDERS,
} from "./provider.js";

describe("chooseProvider", () => {
  it("prefers claude when several keys are present", () => {
    expect(
      chooseProvider({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o", GLM_API_KEY: "g" }),
    ).toEqual({ provider: "claude", model: undefined });
  });

  it("falls back through the registry order", () => {
    expect(chooseProvider({ OPENAI_API_KEY: "o" }).provider).toBe("openai");
    expect(chooseProvider({ GLM_API_KEY: "g" }).provider).toBe("glm");
    expect(chooseProvider({ QWEN_API_KEY: "q" }).provider).toBe("qwen");
  });

  it("applies per-provider default models with env override", () => {
    expect(chooseProvider({ GLM_API_KEY: "g" }).model).toBe("glm-4.6");
    expect(chooseProvider({ GLM_API_KEY: "g", GLM_MODEL: "glm-5" }).model).toBe("glm-5");
    expect(chooseProvider({ QWEN_API_KEY: "q" }).model).toBe("qwen3-coder-plus");
  });

  it("honors an explicit GITBOUNTY_LLM override", () => {
    expect(
      chooseProvider({ GITBOUNTY_LLM: "qwen", ANTHROPIC_API_KEY: "a", QWEN_API_KEY: "q" }).provider,
    ).toBe("qwen");
  });

  it("rejects an override without its key", () => {
    expect(() => chooseProvider({ GITBOUNTY_LLM: "openai", ANTHROPIC_API_KEY: "a" })).toThrow(
      /requires OPENAI_API_KEY/,
    );
  });

  it("rejects unknown providers and missing keys", () => {
    expect(() => chooseProvider({ GITBOUNTY_LLM: "llama-farm" })).toThrow(
      /available: claude, openai/,
    );
    expect(() => chooseProvider({})).toThrow(/no LLM configured/);
  });
});

describe("createGenerator", () => {
  it("instantiates the claude generator", () => {
    expect(createGenerator({ ANTHROPIC_API_KEY: "a" })).toBeInstanceOf(ClaudeFixGenerator);
  });

  it("instantiates a vendor generator for every openai-compatible provider", () => {
    const envs = [
      { OPENAI_API_KEY: "k" },
      { DEEPSEEK_API_KEY: "k" },
      { QWEN_API_KEY: "k" },
      { GLM_API_KEY: "k" },
      { KIMI_API_KEY: "k" },
      { XAI_API_KEY: "k" },
      { GEMINI_API_KEY: "k" },
      { MISTRAL_API_KEY: "k" },
    ];
    for (const env of envs) {
      expect(createGenerator(env)).toBeInstanceOf(OpenAICompatibleFixGenerator);
    }
  });

  it("requires base url and model for the custom provider", () => {
    expect(() => createGenerator({ LLM_API_KEY: "k" })).toThrow(/requires LLM_BASE_URL/);
    expect(() =>
      createGenerator({ LLM_API_KEY: "k", LLM_BASE_URL: "https://api.example.com/v1" }),
    ).toThrow(/requires LLM_MODEL/);
    expect(
      createGenerator({
        LLM_API_KEY: "k",
        LLM_BASE_URL: "https://api.example.com/v1",
        LLM_MODEL: "some-model",
      }),
    ).toBeInstanceOf(OpenAICompatibleFixGenerator);
  });
});

describe("PROVIDERS registry", () => {
  it("keeps names and key envs unique", () => {
    const names = PROVIDERS.map((p) => p.name);
    const keys = PROVIDERS.map((p) => p.apiKeyEnv);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("BYOK entry points", () => {
  it("builds a generator from a user-supplied key and model", () => {
    expect(
      createGeneratorFor("deepseek", { apiKey: "user-key", model: "deepseek-reasoner" }),
    ).toBeInstanceOf(OpenAICompatibleFixGenerator);
    expect(createGeneratorFor("claude", { apiKey: "user-key" })).toBeInstanceOf(ClaudeFixGenerator);
  });

  it("rejects unknown providers", () => {
    expect(() => createGeneratorFor("llama-farm", { apiKey: "k" })).toThrow(/unknown provider/);
  });

  it("lists providers with default models for a picker UI", () => {
    const providers = listProviders();
    expect(providers.map((p) => p.name)).toContain("claude");
    expect(providers.find((p) => p.name === "deepseek")?.defaultModel).toBe("deepseek-chat");
  });
});
