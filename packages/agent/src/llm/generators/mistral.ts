// Mistral — OpenAI-compatible endpoint with vendor defaults baked in.
import { BaseFixGenerator, type BaseFixGeneratorOptions } from "./base.js";

export class MistralFixGenerator extends BaseFixGenerator {
  static readonly DEFAULT_MODEL = "codestral-latest";
  static readonly DEFAULT_BASE_URL = "https://api.mistral.ai/v1";

  constructor(options: BaseFixGeneratorOptions = {}) {
    super({
      ...options,
      model: options.model ?? MistralFixGenerator.DEFAULT_MODEL,
      baseURL: options.baseURL ?? MistralFixGenerator.DEFAULT_BASE_URL,
    });
  }
}
