// Single source of truth for model configuration

export interface ModelConfig {
  id: string; // Short ID used in code (e.g., "claude-haiku")
  fullName: string; // Full API name (e.g., "anthropic/claude-haiku-4.5")
  provider: string; // Provider name for grouping/coloring
  color: string; // UI color
  inputPrice: number; // Price per 1M input tokens in USD
  outputPrice: number; // Price per 1M output tokens in USD
  maxInstances?: number; // Max instances allowed in consensus (optional, default: unlimited)
}

export const MODELS: ModelConfig[] = [
  {
    id: "claude-haiku",
    fullName: "anthropic/claude-haiku-4.5",
    provider: "anthropic",
    color: "#a78bfa",
    inputPrice: 1.0,
    outputPrice: 5.0,
  },
  {
    id: "claude-sonnet",
    fullName: "anthropic/claude-sonnet-4.5",
    provider: "anthropic",
    color: "#a78bfa",
    inputPrice: 3.0,
    outputPrice: 15.0,
  },
  {
    id: "gpt-4o-mini",
    fullName: "openai/gpt-4o-mini",
    provider: "openai",
    color: "#86efac",
    inputPrice: 0.15,
    outputPrice: 0.6,
  },
  {
    id: "gpt-4o",
    fullName: "openai/gpt-4o",
    provider: "openai",
    color: "#86efac",
    inputPrice: 3.0,
    outputPrice: 10.0,
  },
  {
    id: "gpt-5.2",
    fullName: "openai/gpt-5.2",
    provider: "openai",
    color: "#86efac",
    inputPrice: 1.75,
    outputPrice: 14.0,
  },
  {
    id: "gpt-5.2-pro",
    fullName: "openai/gpt-5.2-pro",
    provider: "openai",
    color: "#86efac",
    inputPrice: 21.0,
    outputPrice: 168.0,
    maxInstances: 3,
  },
  {
    id: "gpt-oss-20b",
    fullName: "openai/gpt-oss-20b",
    provider: "openai",
    color: "#86efac",
    inputPrice: 0.08,
    outputPrice: 0.16,
  },
  {
    id: "gpt-oss-120b",
    fullName: "openai/gpt-oss-120b",
    provider: "openai",
    color: "#86efac",
    inputPrice: 0.25,
    outputPrice: 0.69,
  },
  {
    id: "gemini-2.5-flash-lite",
    fullName: "google/gemini-2.5-flash-lite",
    provider: "google",
    color: "#93c5fd",
    inputPrice: 0.1,
    outputPrice: 0.4,
  },
  {
    id: "ministral-3b",
    fullName: "mistral/ministral-3b",
    provider: "mistral",
    color: "#fda4af",
    inputPrice: 0.04,
    outputPrice: 0.04,
  },
  {
    id: "grok-4-fast",
    fullName: "xai/grok-4.1-fast-non-reasoning",
    provider: "xai",
    color: "#fbbf24",
    inputPrice: 5.0,
    outputPrice: 25.0,
  },
  {
    id: "grok-code-fast-1",
    fullName: "xai/grok-code-fast-1",
    provider: "xai",
    color: "#fbbf24",
    inputPrice: 0.2,
    outputPrice: 0.6,
  },

  // Ultra-fast Cerebras models (2000+ tokens/s)
  {
    id: "cerebras-llama-3.3-70b",
    fullName: "meta/llama-3.3-70b",
    provider: "cerebras",
    color: "#f472b6",
    inputPrice: 0.08,
    outputPrice: 0.2,
  },

  // Fast Groq models (low latency)
  {
    id: "groq-llama-3.3-70b",
    fullName: "meta/llama-3.3-70b",
    provider: "groq",
    color: "#fb923c",
    inputPrice: 0.15,
    outputPrice: 0.75,
  },
  {
    id: "groq-llama-4-scout",
    fullName: "meta/llama-4-scout",
    provider: "groq",
    color: "#fb923c",
    inputPrice: 0.11,
    outputPrice: 0.34,
  },
  {
    id: "glm-4.6",
    fullName: "zai/glm-4.6",
    provider: "zai",
    color: "#22d3ee",
    inputPrice: 0.4,
    outputPrice: 1.75,
  },
  {
    id: "llama-3.1-8b",
    fullName: "meta/llama-3.1-8b",
    provider: "meta",
    color: "#a855f7",
    inputPrice: 0.07,
    outputPrice: 0.3,
  },
  {
    id: "nova-micro",
    fullName: "amazon/nova-micro",
    provider: "amazon",
    color: "#ff9900",
    inputPrice: 0.03,
    outputPrice: 0.05,
  },
];

// Derived exports
export const MODEL_IDS = [
  "claude-haiku",
  "claude-sonnet",
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-5.2",
  "gpt-5.2-pro",
  "gpt-oss-20b",
  "gpt-oss-120b",
  "gemini-2.5-flash-lite",
  "ministral-3b",
  "grok-4-fast",
  "grok-code-fast-1",
  "cerebras-llama-3.3-70b",
  "groq-llama-3.3-70b",
  "groq-llama-4-scout",
  "glm-4.6",
  "llama-3.1-8b",
  "nova-micro",
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
