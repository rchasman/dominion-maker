import { uiLogger } from "../lib/logger";
/**
 * Shared agent types to avoid circular dependencies
 */

import type { ModelProvider } from "../config/models";
import { MODEL_IDS, MODELS } from "../config/models";

// Model settings for consensus
export interface ModelSettings {
  enabledModels: Set<ModelProvider>;
  consensusCount: number;
  customStrategy?: string;
  dataFormat: "toon" | "json" | "mixed";
}

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  enabledModels: new Set([
    "gpt-4o-mini", // $0.00028/move - cheapest
    "ministral-3b", // $0.0023/move - 2nd cheapest
    "gpt-oss-20b", // $0.0065/move - 3rd cheapest
    "groq-llama-4-scout", // $0.0077/move - 4th cheapest
  ]),
  consensusCount: 12,
  customStrategy: "",
  dataFormat: "toon",
};

// Available unique models
export const AVAILABLE_MODELS: ModelProvider[] = MODEL_IDS;

// Default: cheapest model instances for cost-effective consensus (duplicates allowed)
export const ALL_FAST_MODELS: ModelProvider[] = [
  "gpt-4o-mini",
  "gpt-4o-mini",
  "gpt-4o-mini",
  "gpt-4o-mini",
  "gpt-4o-mini",
  "ministral-3b",
  "ministral-3b",
  "ministral-3b",
  "gpt-oss-20b",
  "gpt-oss-20b",
  "groq-llama-4-scout",
  "groq-llama-4-scout",
];

// Build models array from settings by shuffling and duplicating enabled models
export function buildModelsFromSettings({
  enabledModels,
  consensusCount,
}: ModelSettings): ModelProvider[] {
  const enabled = Array.from(enabledModels);

  if (enabled.length === 0) {
    uiLogger.warn("No models enabled, using defaults");
    return ALL_FAST_MODELS;
  }

  // Separate models with maxInstances from those without
  const modelsWithoutLimits = enabled.filter(modelId => {
    const config = MODELS.find(m => m.id === modelId);
    return config?.maxInstances === undefined;
  });

  // Build array respecting maxInstances
  const models: ModelProvider[] = [];
  const instanceCounts = new Map<ModelProvider, number>();

  // Fill array by cycling through all enabled models
  for (let i = 0; i < consensusCount; i++) {
    const modelId = enabled[i % enabled.length];
    const config = MODELS.find(m => m.id === modelId);
    const currentCount = instanceCounts.get(modelId) ?? 0;

    // Check if model has reached its limit
    if (config?.maxInstances && currentCount >= config.maxInstances) {
      // Try to find another model that hasn't reached its limit
      const availableModel = enabled.find(id => {
        const cfg = MODELS.find(m => m.id === id);
        const count = instanceCounts.get(id) ?? 0;
        return !cfg?.maxInstances || count < cfg.maxInstances;
      });

      if (availableModel) {
        models.push(availableModel);
        instanceCounts.set(
          availableModel,
          (instanceCounts.get(availableModel) ?? 0) + 1,
        );
      } else {
        // All models at limit, fall back to cycling through unlimited models
        const fallbackModel =
          modelsWithoutLimits[i % (modelsWithoutLimits.length || 1)] ??
          enabled[0];
        models.push(fallbackModel);
        instanceCounts.set(
          fallbackModel,
          (instanceCounts.get(fallbackModel) ?? 0) + 1,
        );
      }
    } else {
      models.push(modelId);
      instanceCounts.set(modelId, currentCount + 1);
    }
  }

  // Shuffle for randomness
  return models
    .map((_, i, arr) => {
      const j = Math.floor(Math.random() * (i + 1));
      return i === 0 ? arr[0] : arr[j];
    })
    .reduceRight<ModelProvider[]>(
      (result, _, currentIndex) => {
        if (currentIndex === 0) return result;
        const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
        [result[currentIndex], result[randomIndex]] = [
          result[randomIndex],
          result[currentIndex],
        ];
        return result;
      },
      [...models],
    );
}
