// The price table. Edit this file to change a model or its prices; nothing else needs to change.
// Prices are USD per one million tokens. They are deliberately the undiscounted list prices, so
// a temporary provider discount makes the app slightly more profitable rather than a loss.

export interface ModelConfig {
  /** OpenRouter model id. */
  id: string;
  label: string;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  /** Cap on tokens generated in a single model step. */
  maxOutputTokens: number;
}

export const DEFAULT_MODEL: ModelConfig = {
  id: "z-ai/glm-5.2",
  label: "GLM 5.2",
  inputUsdPerMillion: 1.4,
  outputUsdPerMillion: 4.4,
  maxOutputTokens: 6000,
};

// Used only when the default model fails before producing any output.
export const FALLBACK_MODEL: ModelConfig = {
  id: "deepseek/deepseek-v3.2",
  label: "DeepSeek V3.2",
  inputUsdPerMillion: 0.29,
  outputUsdPerMillion: 0.43,
  maxOutputTokens: 6000,
};

export const MODELS: ReadonlyArray<ModelConfig> = [DEFAULT_MODEL, FALLBACK_MODEL];

// Unknown ids (for example a model that was removed from this table) are billed at the
// default model's prices, which are the higher of the two, instead of being billed at zero.
export function priceFor(modelId: string): ModelConfig {
  return MODELS.find((model) => model.id === modelId) ?? DEFAULT_MODEL;
}

export function costUsd(modelId: string, inputTokens: number, outputTokens: number): number {
  const model = priceFor(modelId);
  return (
    (inputTokens * model.inputUsdPerMillion) / 1_000_000 +
    (outputTokens * model.outputUsdPerMillion) / 1_000_000
  );
}
