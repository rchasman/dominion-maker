import { uiLogger } from "../lib/logger";
/**
 * Shared agent types to avoid circular dependencies
 */

import type { ModelProvider } from "../config/models";
import { MODEL_IDS } from "../config/models";

// Model settings for consensus
export interface ModelSettings {
  enabledModels: Set<ModelProvider>;
  consensusCount: number;
  customStrategy?: string;
}

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  enabledModels: new Set([
    "cerebras-llama-3.3-70b", // 2130 tok/s - fastest
    "gemini-2.5-flash-lite", // 496 tok/s - reliable
    "gpt-oss-20b", // OpenAI OSS fast
    "groq-llama-4-scout", // 412 tok/s - Groq
  ]),
  consensusCount: 12,
  customStrategy: "",
};

// Available unique models
export const AVAILABLE_MODELS: ModelProvider[] = MODEL_IDS;

// Default: fast model instances for maximum consensus (duplicates allowed)
export const ALL_FAST_MODELS: ModelProvider[] = [
  "cerebras-llama-3.3-70b",
  "cerebras-llama-3.3-70b",
  "cerebras-llama-3.3-70b",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash-lite",
  "gpt-oss-20b",
  "gpt-oss-20b",
  "groq-llama-4-scout",
  "groq-llama-4-scout",
  "gpt-4o-mini",
  "gpt-4o-mini",
  "groq-llama-3.3-70b",
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

  // Create array by cycling through enabled models then shuffle
  const models = Array.from(
    { length: consensusCount },
    (_, i) => enabled[i % enabled.length],
  );

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
