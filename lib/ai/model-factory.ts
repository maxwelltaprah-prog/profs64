import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { type LanguageModel } from "ai";

import { modelMode } from "./config";
import { createFakeModel } from "./fake-model";
import { DEFAULT_MODEL, FALLBACK_MODEL, type ModelConfig } from "./models";

type ModelObject = Extract<LanguageModel, { specificationVersion: "v4" }>;
type StreamOptions = Parameters<ModelObject["doStream"]>[0];
type GenerateOptions = Parameters<ModelObject["doGenerate"]>[0];

export interface ChosenModel {
  model: ModelObject;
  /** The model that actually answered; the fallback only after the default failed to start. */
  usedModelId: () => string;
}

// Tries the default model and, only if it fails before returning a stream, the fallback. Once a
// stream has started there is no switching, so a half-answered request is never repeated.
function withFallback(
  primary: ModelObject,
  fallback: ModelObject,
  primaryId: string,
  fallbackId: string,
): ChosenModel {
  let used = primaryId;
  const model: ModelObject = {
    specificationVersion: primary.specificationVersion,
    provider: primary.provider,
    modelId: primary.modelId,
    supportedUrls: primary.supportedUrls,
    doGenerate: (options: GenerateOptions) => primary.doGenerate(options),
    doStream: async (options: StreamOptions) => {
      try {
        used = primaryId;
        return await primary.doStream(options);
      } catch {
        used = fallbackId;
        return fallback.doStream(options);
      }
    },
  } as ModelObject;
  return { model, usedModelId: () => used };
}

export function chooseModel(): ChosenModel {
  if (modelMode() === "fake") {
    return { model: createFakeModel() as ModelObject, usedModelId: () => DEFAULT_MODEL.id };
  }
  const apiKey = process.env["OPENROUTER_API_KEY"];
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  const openrouter = createOpenRouter({ apiKey });
  // usage.include asks OpenRouter to report token counts (and cost) with the response.
  const make = (config: ModelConfig): ModelObject =>
    openrouter(config.id, { usage: { include: true } }) as ModelObject;
  return withFallback(
    make(DEFAULT_MODEL),
    make(FALLBACK_MODEL),
    DEFAULT_MODEL.id,
    FALLBACK_MODEL.id,
  );
}
