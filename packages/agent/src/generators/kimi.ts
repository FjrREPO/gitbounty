// Kimi — OpenAI-compatible endpoint with vendor defaults baked in.
import {
  OpenAICompatibleFixGenerator,
  type OpenAICompatibleFixGeneratorOptions,
} from "./openai-compatible.js";

export class KimiFixGenerator extends OpenAICompatibleFixGenerator {
  static readonly DEFAULT_MODEL = "kimi-k2-turbo-preview";
  static readonly DEFAULT_BASE_URL = "https://api.moonshot.ai/v1";

  constructor(options: OpenAICompatibleFixGeneratorOptions = {}) {
    super({
      ...options,
      model: options.model ?? KimiFixGenerator.DEFAULT_MODEL,
      baseURL: options.baseURL ?? KimiFixGenerator.DEFAULT_BASE_URL,
    });
  }
}
