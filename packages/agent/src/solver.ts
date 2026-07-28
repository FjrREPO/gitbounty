import Anthropic from "@anthropic-ai/sdk";
import type { FixGenerator, FixTask, GeneratedFix } from "./types.js";

export const FIX_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "One-paragraph explanation of the fix, written for the PR body",
    },
    prTitle: {
      type: "string",
      description: "Conventional, concise pull request title",
    },
    files: {
      type: "array",
      description: "Every file that must change, with its complete new content",
      items: {
        type: "object",
        properties: {
          path: { type: "string", description: "Repo-relative path" },
          content: { type: "string", description: "Full new file content" },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "prTitle", "files"],
  additionalProperties: false,
} as const;

export function buildFixPrompt(task: FixTask): string {
  const fileSections = task.files
    .map((file) => `### ${file.path}\n\`\`\`\n${file.content}\n\`\`\``)
    .join("\n\n");

  return [
    `You are an autonomous software engineer fixing a GitHub issue in ${task.repo.owner}/${task.repo.repo}.`,
    "",
    `## Issue #${task.issue.number}: ${task.issue.title}`,
    "",
    task.issue.body || "(no issue body)",
    "",
    "## Repository files",
    "",
    fileSections,
    "",
    "## Instructions",
    "",
    "Fix the issue with the smallest correct change. Return every file that must change with its complete new content — files you do not return stay untouched. Match the style of the surrounding code. Do not refactor beyond what the fix requires.",
  ].join("\n");
}

/** Validates the model's structured output before it touches the filesystem. */
export function parseGeneratedFix(raw: string): GeneratedFix {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("fix generator returned invalid JSON");
  }
  const fix = parsed as GeneratedFix;
  if (
    typeof fix.summary !== "string" ||
    typeof fix.prTitle !== "string" ||
    !Array.isArray(fix.files) ||
    fix.files.length === 0 ||
    fix.files.some((f) => typeof f.path !== "string" || typeof f.content !== "string")
  ) {
    throw new Error("fix generator returned an unexpected shape");
  }
  return fix;
}

export interface ClaudeFixGeneratorOptions {
  client?: Anthropic;
  model?: string;
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
    this.client = options.client ?? new Anthropic();
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
