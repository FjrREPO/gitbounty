import type { FixGenerator } from "../types.js";
import { BaseFixGenerator, type BaseFixGeneratorOptions } from "./generators/base.js";
import { ClaudeFixGenerator } from "./generators/claude.js";
import { DeepSeekFixGenerator } from "./generators/deepseek.js";
import { GeminiFixGenerator } from "./generators/gemini.js";
import { GlmFixGenerator } from "./generators/glm.js";
import { GrokFixGenerator } from "./generators/grok.js";
import { KimiFixGenerator } from "./generators/kimi.js";
import { MistralFixGenerator } from "./generators/mistral.js";
import { OpenAIFixGenerator } from "./generators/openai.js";
import { QwenFixGenerator } from "./generators/qwen.js";

export interface ProviderDefinition {
  /** Name accepted by GITBOUNTY_LLM. */
  name: string;
  apiKeyEnv: string;
  modelEnv: string;
  /** Overridable endpoint for openai-compatible providers. */
  baseUrlEnv?: string;
  /** Default model, surfaced for logging; the generator owns the value. */
  defaultModel?: string;
  create(options: BaseFixGeneratorOptions): FixGenerator;
}

/**
 * LLM provider registry, ordered by preference. Each vendor has its own
 * generator in `generators/`; adding another AI is one small generator file
 * plus one entry here — or zero code via the `custom` slot.
 */
export const PROVIDERS: readonly ProviderDefinition[] = [
  {
    name: "claude",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    modelEnv: "ANTHROPIC_MODEL",
    create: ({ model, apiKey }) => new ClaudeFixGenerator({ model, apiKey }),
  },
  {
    name: "openai",
    apiKeyEnv: "OPENAI_API_KEY",
    modelEnv: "OPENAI_MODEL",
    defaultModel: OpenAIFixGenerator.DEFAULT_MODEL,
    create: (options) => new OpenAIFixGenerator(options),
  },
  {
    name: "deepseek",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    modelEnv: "DEEPSEEK_MODEL",
    baseUrlEnv: "DEEPSEEK_BASE_URL",
    defaultModel: DeepSeekFixGenerator.DEFAULT_MODEL,
    create: (options) => new DeepSeekFixGenerator(options),
  },
  {
    name: "qwen",
    apiKeyEnv: "QWEN_API_KEY",
    modelEnv: "QWEN_MODEL",
    baseUrlEnv: "QWEN_BASE_URL",
    defaultModel: QwenFixGenerator.DEFAULT_MODEL,
    create: (options) => new QwenFixGenerator(options),
  },
  {
    name: "glm",
    apiKeyEnv: "GLM_API_KEY",
    modelEnv: "GLM_MODEL",
    baseUrlEnv: "GLM_BASE_URL",
    defaultModel: GlmFixGenerator.DEFAULT_MODEL,
    create: (options) => new GlmFixGenerator(options),
  },
  {
    name: "kimi",
    apiKeyEnv: "KIMI_API_KEY",
    modelEnv: "KIMI_MODEL",
    baseUrlEnv: "KIMI_BASE_URL",
    defaultModel: KimiFixGenerator.DEFAULT_MODEL,
    create: (options) => new KimiFixGenerator(options),
  },
  {
    name: "grok",
    apiKeyEnv: "XAI_API_KEY",
    modelEnv: "XAI_MODEL",
    baseUrlEnv: "XAI_BASE_URL",
    defaultModel: GrokFixGenerator.DEFAULT_MODEL,
    create: (options) => new GrokFixGenerator(options),
  },
  {
    name: "gemini",
    apiKeyEnv: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    baseUrlEnv: "GEMINI_BASE_URL",
    defaultModel: GeminiFixGenerator.DEFAULT_MODEL,
    create: (options) => new GeminiFixGenerator(options),
  },
  {
    name: "mistral",
    apiKeyEnv: "MISTRAL_API_KEY",
    modelEnv: "MISTRAL_MODEL",
    baseUrlEnv: "MISTRAL_BASE_URL",
    defaultModel: MistralFixGenerator.DEFAULT_MODEL,
    create: (options) => new MistralFixGenerator(options),
  },
  {
    // Any other OpenAI-compatible endpoint: set LLM_BASE_URL + LLM_MODEL.
    name: "custom",
    apiKeyEnv: "LLM_API_KEY",
    modelEnv: "LLM_MODEL",
    baseUrlEnv: "LLM_BASE_URL",
    create: (options) => {
      if (!options.baseURL) {
        throw new Error('provider "custom" requires LLM_BASE_URL');
      }
      if (!options.model) {
        throw new Error('provider "custom" requires LLM_MODEL');
      }
      return new BaseFixGenerator(options);
    },
  },
];

export interface ProviderChoice {
  provider: string;
  model: string | undefined;
}

type Env = Record<string, string | undefined>;

function resolve(env: Env): { definition: ProviderDefinition; model: string | undefined } {
  const forced = env.GITBOUNTY_LLM;
  let definition: ProviderDefinition | undefined;
  if (forced) {
    definition = PROVIDERS.find((p) => p.name === forced);
    if (!definition) {
      const names = PROVIDERS.map((p) => p.name).join(", ");
      throw new Error(`invalid GITBOUNTY_LLM: "${forced}" (available: ${names})`);
    }
    if (!env[definition.apiKeyEnv]) {
      throw new Error(`GITBOUNTY_LLM=${forced} requires ${definition.apiKeyEnv}`);
    }
  } else {
    definition = PROVIDERS.find((p) => env[p.apiKeyEnv]);
    if (!definition) {
      const keys = PROVIDERS.map((p) => p.apiKeyEnv).join(", ");
      throw new Error(`no LLM configured: set one of ${keys} (or GITBOUNTY_LLM)`);
    }
  }
  return { definition, model: env[definition.modelEnv] ?? definition.defaultModel };
}

/** Picks the provider: an explicit GITBOUNTY_LLM wins, else the first configured key. */
export function chooseProvider(env: Env): ProviderChoice {
  const { definition, model } = resolve(env);
  return { provider: definition.name, model };
}

/** Instantiates the FixGenerator for the chosen provider. */
export function createGenerator(env: Env): FixGenerator {
  const { definition } = resolve(env);
  return definition.create({
    model: env[definition.modelEnv],
    apiKey: env[definition.apiKeyEnv],
    baseURL: definition.baseUrlEnv ? env[definition.baseUrlEnv] : undefined,
  });
}

/**
 * BYOK entry point: builds a generator from a user-supplied key and model
 * choice, independent of environment variables. This is what a hosted
 * bring-your-own-key + model-picker flow calls per user.
 */
export function createGeneratorFor(
  providerName: string,
  options: BaseFixGeneratorOptions & { apiKey: string },
): FixGenerator {
  const definition = PROVIDERS.find((p) => p.name === providerName);
  if (!definition) {
    const names = PROVIDERS.map((p) => p.name).join(", ");
    throw new Error(`unknown provider: "${providerName}" (available: ${names})`);
  }
  return definition.create(options);
}

/** Providers with their default models, for model-picker UIs. */
export function listProviders(): { name: string; defaultModel: string | undefined }[] {
  return PROVIDERS.map((p) => ({ name: p.name, defaultModel: p.defaultModel }));
}
