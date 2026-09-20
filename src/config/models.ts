// Model catalog. The list itself is generated from the AI Gateway (see
// scripts/refresh-models.ts and ./model-overrides.ts); this file holds the
// type and the lookups built on top of it.

import { GENERATED_MODELS } from "./models.generated";

export type { ModelConfig } from "./model-config";

export const MODELS = GENERATED_MODELS;

// Derived exports — MODEL_IDS and ModelProvider stay in sync with MODELS automatically
export type ModelProvider = (typeof MODELS)[number]["id"];
export const MODEL_IDS: ModelProvider[] = MODELS.map(m => m.id);

export const MODEL_MAP: Record<string, string> = Object.fromEntries(
  MODELS.map(m => [m.id, m.fullName]),
);

export const PROVIDER_COLORS: Record<string, string> = Object.fromEntries(
  MODELS.map(m => [m.provider, m.color]),
);

export function getModelColor(modelId: string): string {
  const model = MODELS.find(m => m.id === modelId);
  return model?.color ?? "var(--color-text-secondary)";
}

export function getProviderColor(provider: string): string {
  return PROVIDER_COLORS[provider] ?? "var(--color-text-secondary)";
}

export function getModelFullName(modelId: string): string {
  return MODEL_MAP[modelId] ?? modelId;
}
