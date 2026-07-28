import OpenAI from "openai";
import type { FixGenerator, FixTask, GeneratedFix } from "../types.js";
import { buildFixPrompt, FIX_SCHEMA, parseGeneratedFix } from "./prompt.js";

export interface OpenAICompatibleFixGeneratorOptions {
  client?: OpenAI;
  model?: string;
  /** Point at any OpenAI-compatible endpoint (OpenAI, GLM, Qwen, DeepSeek, ...). */
  baseURL?: string;
  apiKey?: string;
}

/**
 * Base fix generator for any OpenAI-compatible API. Vendor generators
 * (openai, deepseek, qwen, glm, ...) extend this with their default model
 * and endpoint. Uses the same prompt, schema, and validation as the Claude
 * generator.
 */
export class OpenAICompatibleFixGenerator implements FixGenerator {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: OpenAICompatibleFixGeneratorOptions = {}) {
    if (!options.model) {
      throw new Error("model is required for an OpenAI-compatible generator");
    }
    this.client =
      options.client ?? new OpenAI({ apiKey: options.apiKey, baseURL: options.baseURL });
    this.model = options.model;
  }

  async generateFix(task: FixTask): Promise<GeneratedFix> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      response_format: {
        type: "json_schema",
        json_schema: { name: "generated_fix", strict: true, schema: FIX_SCHEMA },
      },
      messages: [{ role: "user", content: buildFixPrompt(task) }],
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new Error("fix generator returned no choices");
    }
    if (choice.message.refusal) {
      throw new Error(`fix generation refused for issue #${task.issue.number}`);
    }
    if (!choice.message.content) {
      throw new Error("fix generator returned no content");
    }
    return parseGeneratedFix(choice.message.content);
  }
}
