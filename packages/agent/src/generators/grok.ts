// Grok — OpenAI-compatible endpoint with vendor defaults baked in.
import {
  OpenAICompatibleFixGenerator,
  type OpenAICompatibleFixGeneratorOptions,
} from "./openai-compatible.js";

export class GrokFixGenerator extends OpenAICompatibleFixGenerator {
  static readonly DEFAULT_MODEL = "grok-code-fast-1";
  static readonly DEFAULT_BASE_URL = "https://api.x.ai/v1";

  constructor(options: OpenAICompatibleFixGeneratorOptions = {}) {
    super({
      ...options,
      model: options.model ?? GrokFixGenerator.DEFAULT_MODEL,
      baseURL: options.baseURL ?? GrokFixGenerator.DEFAULT_BASE_URL,
    });
  }
}
