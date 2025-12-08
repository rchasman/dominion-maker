/**
 * Shared agent types to avoid circular dependencies
 */

import type { ModelProvider } from "../config/models";
import { MODEL_IDS } from "../config/models";

// Model settings for consensus
export interface ModelSettings {
  enabledModels: Set<ModelProvider>;
  consensusCount: number;
}

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  enabledModels: new Set([
    "cerebras-llama-3.3-70b",
    "groq-llama-3.3-70b",
    "groq-llama-4-scout",
    "gemini-2.5-flash-lite",
    "gpt-4o-mini",
  ]),
  consensusCount: 8,
};

// Available unique models
export const AVAILABLE_MODELS: ModelProvider[] = MODEL_IDS as ModelProvider[];

// Default: 8 fast model instances for maximum consensus (duplicates allowed)
export const ALL_FAST_MODELS: ModelProvider[] = [
  "cerebras-llama-3.3-70b",
  "groq-llama-3.3-70b",
  "groq-llama-4-scout",
  "gemini-2.5-flash-lite",
  "gpt-4o-mini",
  "cerebras-llama-3.3-70b",
  "groq-llama-3.3-70b",
  "gemini-2.5-flash-lite",
];

// Build models array from settings by shuffling and duplicating enabled models
export function buildModelsFromSettings({ enabledModels, consensusCount }: ModelSettings): ModelProvider[] {
  const enabled = Array.from(enabledModels);

  if (enabled.length === 0) {
    console.warn("No models enabled, using defaults");
    return ALL_FAST_MODELS;
  }

  // Create array by cycling through enabled models then shuffle
  const models = Array.from({ length: consensusCount }, (_, i) => enabled[i % enabled.length]);

  // Shuffle for randomness
  return models.map((_, i, arr) => {
    const j = Math.floor(Math.random() * (i + 1));
    return i === 0 ? arr[0] : arr[j];
  }).reduceRight<ModelProvider[]>((result, _, currentIndex) => {
    if (currentIndex === 0) return result;
    const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
    [result[currentIndex], result[randomIndex]] = [result[randomIndex], result[currentIndex]];
    return result;
  }, [...models]);
}
