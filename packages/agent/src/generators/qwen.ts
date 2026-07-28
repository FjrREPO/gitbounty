// Qwen — OpenAI-compatible endpoint with vendor defaults baked in.
import {
  OpenAICompatibleFixGenerator,
  type OpenAICompatibleFixGeneratorOptions,
} from "./openai-compatible.js";

export class QwenFixGenerator extends OpenAICompatibleFixGenerator {
  static readonly DEFAULT_MODEL = "qwen3-coder-plus";
  static readonly DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";

  constructor(options: OpenAICompatibleFixGeneratorOptions = {}) {
    super({
      ...options,
      model: options.model ?? QwenFixGenerator.DEFAULT_MODEL,
      baseURL: options.baseURL ?? QwenFixGenerator.DEFAULT_BASE_URL,
    });
  }
}
