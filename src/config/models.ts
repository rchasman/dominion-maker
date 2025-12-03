// Single source of truth for model configuration

export interface ModelConfig {
  id: string;           // Short ID used in code (e.g., "claude-haiku")
  fullName: string;     // Full API name (e.g., "anthropic/claude-haiku-4.5")
  provider: string;     // Provider name for grouping/coloring
  color: string;        // UI color
}

export const MODELS: ModelConfig[] = [
  { id: "claude-haiku", fullName: "anthropic/claude-haiku-4.5", provider: "anthropic", color: "#a78bfa" },
  { id: "claude-sonnet", fullName: "anthropic/claude-sonnet-4.5", provider: "anthropic", color: "#a78bfa" },
  { id: "gpt-4o-mini", fullName: "openai/gpt-4o-mini", provider: "openai", color: "#86efac" },
  { id: "gpt-4o", fullName: "openai/gpt-4o", provider: "openai", color: "#86efac" },
  { id: "gpt-oss-20b", fullName: "openai/gpt-oss-20b", provider: "openai", color: "#86efac" },
  { id: "gpt-oss-120b", fullName: "openai/gpt-oss-120b", provider: "openai", color: "#86efac" },
  { id: "gemini-2.5-flash-lite", fullName: "google/gemini-2.5-flash-lite", provider: "google", color: "#93c5fd" },
  { id: "ministral-3b", fullName: "mistral/ministral-3b", provider: "mistral", color: "#fda4af" },
];

// Derived exports
export const MODEL_IDS = MODELS.map(m => m.id);
export type ModelProvider = typeof MODEL_IDS[number];

export const MODEL_MAP: Record<string, string> = Object.fromEntries(
  MODELS.map(m => [m.id, m.fullName])
);

export const PROVIDER_COLORS: Record<string, string> = Object.fromEntries(
  MODELS.map(m => [m.provider, m.color])
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
