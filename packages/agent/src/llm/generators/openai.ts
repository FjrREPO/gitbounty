// OpenAI — uses the SDK's default endpoint with the vendor default model.
import { BaseFixGenerator, type BaseFixGeneratorOptions } from "./base.js";

export class OpenAIFixGenerator extends BaseFixGenerator {
  static readonly DEFAULT_MODEL = "gpt-5.1";

  constructor(options: BaseFixGeneratorOptions = {}) {
    super({
      ...options,
      model: options.model ?? OpenAIFixGenerator.DEFAULT_MODEL,
    });
  }
}
