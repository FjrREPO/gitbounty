// OpenAI — uses the SDK's default endpoint with the vendor default model.
import {
  OpenAICompatibleFixGenerator,
  type OpenAICompatibleFixGeneratorOptions,
} from "./openai-compatible.js";

export class OpenAIFixGenerator extends OpenAICompatibleFixGenerator {
  static readonly DEFAULT_MODEL = "gpt-5.1";

  constructor(options: OpenAICompatibleFixGeneratorOptions = {}) {
    super({
      ...options,
      model: options.model ?? OpenAIFixGenerator.DEFAULT_MODEL,
    });
  }
}
