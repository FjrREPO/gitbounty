import { ClaudeFixGenerator } from "./solver.js";
import { OpenAIFixGenerator } from "./solver-openai.js";
import type { FixGenerator } from "./types.js";

export interface ProviderDefinition {
  /** Name accepted by GITBOUNTY_LLM. */
  name: string;
  /** "anthropic" uses the Claude SDK; "openai-compatible" covers everything else. */
  kind: "anthropic" | "openai-compatible";
  apiKeyEnv: string;
  modelEnv: string;
  defaultModel?: string;
  /** Overridable endpoint for openai-compatible providers. */
  baseUrlEnv?: string;
  defaultBaseUrl?: string;
}

/**
 * LLM provider registry, ordered by preference. Most AI vendors expose an
 * OpenAI-compatible API, so supporting another one (DeepSeek, Kimi, ...) is
 * a single declarative entry here — or zero entries via the `custom` slot.
 */
export const PROVIDERS: readonly ProviderDefinition[] = [
  {
    name: "claude",
    kind: "anthropic",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    modelEnv: "ANTHROPIC_MODEL",
  },
  {
    name: "openai",
    kind: "openai-compatible",
    apiKeyEnv: "OPENAI_API_KEY",
    modelEnv: "OPENAI_MODEL",
  },
  {
    name: "glm",
    kind: "openai-compatible",
    apiKeyEnv: "GLM_API_KEY",
    modelEnv: "GLM_MODEL",
    defaultModel: "glm-4.6",
    baseUrlEnv: "GLM_BASE_URL",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
  },
  {
    name: "qwen",
    kind: "openai-compatible",
    apiKeyEnv: "QWEN_API_KEY",
    modelEnv: "QWEN_MODEL",
    defaultModel: "qwen3-coder-plus",
    baseUrlEnv: "QWEN_BASE_URL",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  {
    // Any other OpenAI-compatible endpoint: set LLM_BASE_URL + LLM_MODEL.
    name: "custom",
    kind: "openai-compatible",
    apiKeyEnv: "LLM_API_KEY",
    modelEnv: "LLM_MODEL",
    baseUrlEnv: "LLM_BASE_URL",
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
  const { definition, model } = resolve(env);
  if (definition.kind === "anthropic") {
    return new ClaudeFixGenerator({ model });
  }

  const baseURL =
    (definition.baseUrlEnv ? env[definition.baseUrlEnv] : undefined) ?? definition.defaultBaseUrl;
  if (definition.baseUrlEnv && !definition.defaultBaseUrl && !baseURL) {
    throw new Error(`provider "${definition.name}" requires ${definition.baseUrlEnv}`);
  }
  if (!model && !definition.defaultModel && definition.name !== "openai") {
    throw new Error(`provider "${definition.name}" requires ${definition.modelEnv}`);
  }
  return new OpenAIFixGenerator({ model, baseURL, apiKey: env[definition.apiKeyEnv] });
}
