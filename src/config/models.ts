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
  // Anthropic
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
    fullName: "anthropic/claude-sonnet-4.6",
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

  // OpenAI
  {
    id: "gpt-5-nano",
    fullName: "openai/gpt-5-nano",
    provider: "openai",
    color: "#86efac",
    inputPrice: 0.05,
    outputPrice: 0.4,
  },
  {
    id: "gpt-oss-20b",
    fullName: "openai/gpt-oss-20b",
    provider: "openai",
    color: "#86efac",
    inputPrice: 0.05,
    outputPrice: 0.2,
  },
  {
    id: "gpt-5-mini",
    fullName: "openai/gpt-5-mini",
    provider: "openai",
    color: "#86efac",
    inputPrice: 0.25,
    outputPrice: 2.0,
  },
  {
    id: "gpt-oss-120b",
    fullName: "openai/gpt-oss-120b",
    provider: "openai",
    color: "#86efac",
    inputPrice: 0.15,
    outputPrice: 0.6,
  },
  {
    id: "gpt-5",
    fullName: "openai/gpt-5",
    provider: "openai",
    color: "#86efac",
    inputPrice: 1.25,
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
    id: "gpt-5.4-nano",
    fullName: "openai/gpt-5.4-nano",
    provider: "openai",
    color: "#86efac",
    inputPrice: 0.2,
    outputPrice: 1.25,
  },
  {
    id: "gpt-5.4-mini",
    fullName: "openai/gpt-5.4-mini",
    provider: "openai",
    color: "#86efac",
    inputPrice: 0.75,
    outputPrice: 4.5,
  },
  {
    id: "gpt-5.4",
    fullName: "openai/gpt-5.4",
    provider: "openai",
    color: "#86efac",
    inputPrice: 2.5,
    outputPrice: 15.0,
    maxInstances: 3,
  },

  // Google
  {
    id: "gemini-2.5-flash-lite",
    fullName: "google/gemini-2.5-flash-lite",
    provider: "google",
    color: "#93c5fd",
    inputPrice: 0.1,
    outputPrice: 0.4,
  },
  {
    id: "gemini-3.1-flash-lite",
    fullName: "google/gemini-3.1-flash-lite-preview",
    provider: "google",
    color: "#93c5fd",
    inputPrice: 0.25,
    outputPrice: 1.5,
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
    id: "gemini-3-pro",
    fullName: "google/gemini-3-pro-preview",
    provider: "google",
    color: "#93c5fd",
    inputPrice: 2.0,
    outputPrice: 12.0,
    maxInstances: 3,
  },
  {
    id: "gemini-3.1-pro",
    fullName: "google/gemini-3.1-pro-preview",
    provider: "google",
    color: "#93c5fd",
    inputPrice: 2.0,
    outputPrice: 12.0,
    maxInstances: 3,
  },

  // xAI
  {
    id: "grok-4-fast",
    fullName: "xai/grok-4.1-fast-non-reasoning",
    provider: "xai",
    color: "#fbbf24",
    inputPrice: 0.2,
    outputPrice: 0.5,
  },

  // DeepSeek
  {
    id: "deepseek-v3.2",
    fullName: "deepseek/deepseek-v3.2",
    provider: "deepseek",
    color: "#60a5fa",
    inputPrice: 0.28,
    outputPrice: 0.42,
  },

  // Zhipu AI
  {
    id: "glm-4.6v-flash",
    fullName: "zai/glm-4.6v-flash",
    provider: "zhipu",
    color: "#34d399",
    inputPrice: 0,
    outputPrice: 0,
  },
  {
    id: "glm-5",
    fullName: "zai/glm-5",
    provider: "zhipu",
    color: "#34d399",
    inputPrice: 1.0,
    outputPrice: 3.2,
  },

  // Alibaba
  {
    id: "qwen3.5-flash",
    fullName: "alibaba/qwen3.5-flash",
    provider: "alibaba",
    color: "#f97316",
    inputPrice: 0.1,
    outputPrice: 0.4,
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
