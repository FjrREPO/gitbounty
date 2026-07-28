// DeepSeek — OpenAI-compatible endpoint with vendor defaults baked in.
import {
  OpenAICompatibleFixGenerator,
  type OpenAICompatibleFixGeneratorOptions,
} from "./openai-compatible.js";

export class DeepSeekFixGenerator extends OpenAICompatibleFixGenerator {
  static readonly DEFAULT_MODEL = "deepseek-chat";
  static readonly DEFAULT_BASE_URL = "https://api.deepseek.com";

  constructor(options: OpenAICompatibleFixGeneratorOptions = {}) {
    super({
      ...options,
      model: options.model ?? DeepSeekFixGenerator.DEFAULT_MODEL,
      baseURL: options.baseURL ?? DeepSeekFixGenerator.DEFAULT_BASE_URL,
    });
  }
}
