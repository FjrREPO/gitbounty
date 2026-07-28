// Gemini — OpenAI-compatible endpoint with vendor defaults baked in.
import { BaseFixGenerator, type BaseFixGeneratorOptions } from "./base.js";

export class GeminiFixGenerator extends BaseFixGenerator {
  static readonly DEFAULT_MODEL = "gemini-2.5-pro";
  static readonly DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

  constructor(options: BaseFixGeneratorOptions = {}) {
    super({
      ...options,
      model: options.model ?? GeminiFixGenerator.DEFAULT_MODEL,
      baseURL: options.baseURL ?? GeminiFixGenerator.DEFAULT_BASE_URL,
    });
  }
}
