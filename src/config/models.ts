// Single source of truth for model configuration

export interface ModelConfig {
  id: string; // Short ID used in code (e.g., "claude-haiku")
  fullName: string; // Full API name (e.g., "anthropic/claude-haiku-4.5")
  provider: string; // Provider name for grouping/coloring
  color: string; // UI color
}

export const MODELS: ModelConfig[] = [
  {
    id: "claude-haiku",
    fullName: "anthropic/claude-haiku-4.5",
    provider: "anthropic",
    color: "#a78bfa",
  },
  {
    id: "claude-sonnet",
    fullName: "anthropic/claude-sonnet-4.5",
    provider: "anthropic",
    color: "#a78bfa",
  },
  {
    id: "gpt-4o-mini",
    fullName: "openai/gpt-4o-mini",
    provider: "openai",
    color: "#86efac",
  },
  {
    id: "gpt-4o",
    fullName: "openai/gpt-4o",
    provider: "openai",
    color: "#86efac",
  },
  {
    id: "gpt-oss-20b",
    fullName: "openai/gpt-oss-20b",
    provider: "openai",
    color: "#86efac",
  },
  {
    id: "gpt-oss-120b",
    fullName: "openai/gpt-oss-120b",
    provider: "openai",
    color: "#86efac",
  },
  {
    id: "gemini-2.5-flash-lite",
    fullName: "google/gemini-2.5-flash-lite",
    provider: "google",
    color: "#93c5fd",
  },
  {
    id: "ministral-3b",
    fullName: "mistral/ministral-3b",
    provider: "mistral",
    color: "#fda4af",
  },
  {
    id: "grok-4-fast",
    fullName: "xai/grok-4.1-fast-non-reasoning",
    provider: "xai",
    color: "#fbbf24",
  },
  {
    id: "grok-code-fast-1",
    fullName: "xai/grok-code-fast-1",
    provider: "xai",
    color: "#fbbf24",
  },

  // Ultra-fast Cerebras models (2000+ tokens/s)
  {
    id: "cerebras-llama-3.3-70b",
    fullName: "cerebras/llama-3.3-70b",
    provider: "cerebras",
    color: "#f472b6",
  },

  // Fast Groq models (low latency)
  {
    id: "groq-llama-3.3-70b",
    fullName: "groq/llama-3.3-70b",
    provider: "groq",
    color: "#fb923c",
  },
  {
    id: "groq-llama-4-scout",
    fullName: "groq/llama-4-scout",
    provider: "groq",
    color: "#fb923c",
  },
];

// Derived exports
export const MODEL_IDS = [
  "claude-haiku",
  "claude-sonnet",
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-oss-20b",
  "gpt-oss-120b",
  "gemini-2.5-flash-lite",
  "ministral-3b",
  "grok-4-fast",
  "grok-code-fast-1",
  "cerebras-llama-3.3-70b",
  "groq-llama-3.3-70b",
  "groq-llama-4-scout",
] as const;
export type ModelProvider = (typeof MODEL_IDS)[number];

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
