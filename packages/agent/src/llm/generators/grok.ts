// Grok — OpenAI-compatible endpoint with vendor defaults baked in.
import { BaseFixGenerator, type BaseFixGeneratorOptions } from "./base.js";

export class GrokFixGenerator extends BaseFixGenerator {
  static readonly DEFAULT_MODEL = "grok-code-fast-1";
  static readonly DEFAULT_BASE_URL = "https://api.x.ai/v1";

  constructor(options: BaseFixGeneratorOptions = {}) {
    super({
      ...options,
      model: options.model ?? GrokFixGenerator.DEFAULT_MODEL,
      baseURL: options.baseURL ?? GrokFixGenerator.DEFAULT_BASE_URL,
    });
  }
}
