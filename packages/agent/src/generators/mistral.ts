// Mistral — OpenAI-compatible endpoint with vendor defaults baked in.
import {
  OpenAICompatibleFixGenerator,
  type OpenAICompatibleFixGeneratorOptions,
} from "./openai-compatible.js";

export class MistralFixGenerator extends OpenAICompatibleFixGenerator {
  static readonly DEFAULT_MODEL = "codestral-latest";
  static readonly DEFAULT_BASE_URL = "https://api.mistral.ai/v1";

  constructor(options: OpenAICompatibleFixGeneratorOptions = {}) {
    super({
      ...options,
      model: options.model ?? MistralFixGenerator.DEFAULT_MODEL,
      baseURL: options.baseURL ?? MistralFixGenerator.DEFAULT_BASE_URL,
    });
  }
}
