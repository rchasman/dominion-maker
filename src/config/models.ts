// Single source of truth for model configuration

export interface ModelConfig {
  id: string; // Short ID used in code (e.g., "claude-haiku")
  fullName: string; // Full API name (e.g., "anthropic/claude-haiku-4.5")
  provider: string; // Provider name for grouping/coloring
  color: string; // UI color
  inputPrice: number; // Price per 1M input tokens in USD
  outputPrice: number; // Price per 1M output tokens in USD
  speed?: number; // Tokens per second (optional)
  maxInstances?: number; // Max instances allowed in consensus (optional, default: unlimited)
}

export const MODELS = [
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
    id: "claude-opus",
    fullName: "anthropic/claude-opus-4.6",
    provider: "anthropic",
    color: "#a78bfa",
    inputPrice: 5.0,
    outputPrice: 25.0,
    maxInstances: 3,
  },
  {
    id: "gpt-5.3-chat",
    fullName: "openai/gpt-5.3-chat",
    provider: "openai",
    color: "#86efac",
    inputPrice: 1.75,
    outputPrice: 14.0,
  },
  {
    id: "gpt-5.1-codex-mini",
    fullName: "openai/gpt-5.1-codex-mini",
    provider: "openai",
    color: "#86efac",
    inputPrice: 0.25,
    outputPrice: 2.0,
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
    speed: 496,
  },
  {
    id: "gemini-3-flash",
    fullName: "google/gemini-3-flash",
    provider: "google",
    color: "#93c5fd",
    inputPrice: 0.5,
    outputPrice: 3.0,
  },
  {
    id: "gemini-3.1-flash-lite",
    fullName: "google/gemini-3.1-flash-lite-preview",
    provider: "google",
    color: "#93c5fd",
    inputPrice: 0.08,
    outputPrice: 0.3,
  },
  {
    id: "ministral-3b",
    fullName: "mistral/ministral-3b",
    provider: "mistral",
    color: "#fda4af",
    inputPrice: 0.04,
    outputPrice: 0.04,
    speed: 351,
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

  // Zhipu AI
  {
    id: "glm-5-turbo",
    fullName: "zai/glm-5-turbo",
    provider: "zhipu",
    color: "#34d399",
    inputPrice: 1.0,
    outputPrice: 3.2,
  },

  // Alibaba
  {
    id: "qwen-3.5-flash",
    fullName: "alibaba/qwen3.5-flash",
    provider: "alibaba",
    color: "#f9a8d4",
    inputPrice: 0.1,
    outputPrice: 0.4,
  },

  // Ultra-fast Cerebras models (2000+ tokens/s)
  {
    id: "cerebras-llama-3.3-70b",
    fullName: "meta/llama-3.3-70b",
    provider: "cerebras",
    color: "#f472b6",
    inputPrice: 0.08,
    outputPrice: 0.2,
    speed: 2130,
  },

  // Fast Groq models (low latency)
  {
    id: "groq-llama-3.3-70b",
    fullName: "meta/llama-3.3-70b",
    provider: "groq",
    color: "#fb923c",
    inputPrice: 0.15,
    outputPrice: 0.75,
    speed: 347,
  },
  {
    id: "groq-llama-4-scout",
    fullName: "meta/llama-4-scout",
    provider: "groq",
    color: "#fb923c",
    inputPrice: 0.11,
    outputPrice: 0.34,
    speed: 412,
  },
] as const satisfies readonly ModelConfig[];

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
