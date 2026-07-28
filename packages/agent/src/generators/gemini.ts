// Gemini — OpenAI-compatible endpoint with vendor defaults baked in.
import {
  OpenAICompatibleFixGenerator,
  type OpenAICompatibleFixGeneratorOptions,
} from "./openai-compatible.js";

export class GeminiFixGenerator extends OpenAICompatibleFixGenerator {
  static readonly DEFAULT_MODEL = "gemini-2.5-pro";
  static readonly DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

  constructor(options: OpenAICompatibleFixGeneratorOptions = {}) {
    super({
      ...options,
      model: options.model ?? GeminiFixGenerator.DEFAULT_MODEL,
      baseURL: options.baseURL ?? GeminiFixGenerator.DEFAULT_BASE_URL,
    });
  }
}
