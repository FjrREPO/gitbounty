import Anthropic from "@anthropic-ai/sdk";
import type { FixGenerator, FixTask, GeneratedFix } from "../../types.js";
import { buildFixPrompt, FIX_SCHEMA, parseGeneratedFix } from "../prompt.js";

export interface ClaudeFixGeneratorOptions {
  client?: Anthropic;
  model?: string;
  /** Explicit key for BYOK flows; defaults to ANTHROPIC_API_KEY. */
  apiKey?: string;
}

/**
 * Generates fixes with Claude. Structured output guarantees a parseable
 * fix, and server-side refusal fallbacks reroute policy declines to
 * Anthropic's recommended substitute model instead of failing the run.
 */
export class ClaudeFixGenerator implements FixGenerator {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(options: ClaudeFixGeneratorOptions = {}) {
    this.client = options.client ?? new Anthropic({ apiKey: options.apiKey });
    this.model = options.model ?? "claude-opus-5";
  }

  async generateFix(task: FixTask): Promise<GeneratedFix> {
    const response = await this.client.beta.messages.create({
      model: this.model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { format: { type: "json_schema", schema: FIX_SCHEMA } },
      messages: [{ role: "user", content: buildFixPrompt(task) }],
    });

    if (response.stop_reason === "refusal") {
      throw new Error(`fix generation refused for issue #${task.issue.number}`);
    }
    const text = response.content.find((block) => block.type === "text");
    if (!text) {
      throw new Error("fix generator returned no text content");
    }
    return parseGeneratedFix(text.text);
  }
}
