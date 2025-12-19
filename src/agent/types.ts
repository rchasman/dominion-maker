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
};

// Available unique models
export const AVAILABLE_MODELS: ModelProvider[] = [...MODEL_IDS];

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

  // Fill array by cycling through all enabled models
  const { models } = Array.from(
    { length: consensusCount },
    (_, i) => i,
  ).reduce<{
    models: ModelProvider[];
    instanceCounts: Map<ModelProvider, number>;
  }>(
    (acc, i) => {
      const modelId = enabled[i % enabled.length];
      if (!modelId) {
        throw new Error("Model selection failed: no model available");
      }
      const config = MODELS.find(m => m.id === modelId);
      const currentCount = acc.instanceCounts.get(modelId) ?? 0;

      // Check if model has reached its limit
      if (config?.maxInstances && currentCount >= config.maxInstances) {
        // Try to find another model that hasn't reached its limit
        const availableModel = enabled.find(id => {
          const cfg = MODELS.find(m => m.id === id);
          const count = acc.instanceCounts.get(id) ?? 0;
          return !cfg?.maxInstances || count < cfg.maxInstances;
        });

        if (availableModel) {
          return {
            models: [...acc.models, availableModel],
            instanceCounts: new Map(acc.instanceCounts).set(
              availableModel,
              (acc.instanceCounts.get(availableModel) ?? 0) + 1,
            ),
          };
        }

        // All models at limit, fall back to cycling through unlimited models
        const fallbackModel =
          modelsWithoutLimits[i % (modelsWithoutLimits.length || 1)] ??
          enabled[0];
        if (!fallbackModel) {
          throw new Error("No fallback model available");
        }
        return {
          models: [...acc.models, fallbackModel],
          instanceCounts: new Map(acc.instanceCounts).set(
            fallbackModel,
            (acc.instanceCounts.get(fallbackModel) ?? 0) + 1,
          ),
        };
      }

      return {
        models: [...acc.models, modelId],
        instanceCounts: new Map(acc.instanceCounts).set(
          modelId,
          currentCount + 1,
        ),
      };
    },
    { models: [], instanceCounts: new Map<ModelProvider, number>() },
  );

  // Shuffle for randomness using functional Fisher-Yates algorithm
  return models.reduce<ModelProvider[]>(
    (
      shuffled: ModelProvider[],
      currentValue: ModelProvider,
      currentIndex: number,
    ) => {
      if (currentIndex === 0) return [currentValue];

      const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
      const newShuffled = [...shuffled];

      // Insert at random position by swapping
      if (randomIndex === currentIndex) {
        return [...newShuffled, currentValue];
      }

      const valueAtRandomIndex = newShuffled[randomIndex];
      if (valueAtRandomIndex === undefined) {
        // Should never happen, but handle gracefully
        return [...newShuffled, currentValue];
      }

      return [
        ...newShuffled.slice(0, randomIndex),
        currentValue,
        valueAtRandomIndex,
        ...newShuffled.slice(randomIndex + 1),
      ];
    },
    [],
  );
}
