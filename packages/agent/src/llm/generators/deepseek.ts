// DeepSeek — OpenAI-compatible endpoint with vendor defaults baked in.
import { BaseFixGenerator, type BaseFixGeneratorOptions } from "./base.js";

export class DeepSeekFixGenerator extends BaseFixGenerator {
  static readonly DEFAULT_MODEL = "deepseek-chat";
  static readonly DEFAULT_BASE_URL = "https://api.deepseek.com";

  constructor(options: BaseFixGeneratorOptions = {}) {
    super({
      ...options,
      model: options.model ?? DeepSeekFixGenerator.DEFAULT_MODEL,
      baseURL: options.baseURL ?? DeepSeekFixGenerator.DEFAULT_BASE_URL,
    });
  }
}
