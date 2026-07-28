// Glm — OpenAI-compatible endpoint with vendor defaults baked in.
import { BaseFixGenerator, type BaseFixGeneratorOptions } from "./base.js";

export class GlmFixGenerator extends BaseFixGenerator {
  static readonly DEFAULT_MODEL = "glm-4.6";
  static readonly DEFAULT_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

  constructor(options: BaseFixGeneratorOptions = {}) {
    super({
      ...options,
      model: options.model ?? GlmFixGenerator.DEFAULT_MODEL,
      baseURL: options.baseURL ?? GlmFixGenerator.DEFAULT_BASE_URL,
    });
  }
}
