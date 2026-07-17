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
    fullName: "anthropic/claude-sonnet-5",
    provider: "anthropic",
    color: "#a78bfa",
    inputPrice: 2.0,
    outputPrice: 10.0,
  },
  {
    id: "claude-opus",
    fullName: "anthropic/claude-opus-4.8",
    provider: "anthropic",
    color: "#a78bfa",
    inputPrice: 5.0,
    outputPrice: 25.0,
    maxInstances: 3,
  },

  // OpenAI
  {
    id: "gpt-oss-120b",
    fullName: "openai/gpt-oss-120b",
    provider: "openai",
    color: "#86efac",
    inputPrice: 0.1,
    outputPrice: 0.5,
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
  {
    id: "gpt-5.6-terra",
    fullName: "openai/gpt-5.6-terra",
    provider: "openai",
    color: "#86efac",
    inputPrice: 2.5,
    outputPrice: 15.0,
    maxInstances: 3,
  },

  // Google
  {
    id: "gemini-3.1-flash-lite",
    fullName: "google/gemini-3.1-flash-lite",
    provider: "google",
    color: "#93c5fd",
    inputPrice: 0.25,
    outputPrice: 1.5,
  },
  {
    id: "gemini-3.5-flash",
    fullName: "google/gemini-3.5-flash",
    provider: "google",
    color: "#93c5fd",
    inputPrice: 1.5,
    outputPrice: 9.0,
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
  {
    id: "grok-4.5",
    fullName: "xai/grok-4.5",
    provider: "xai",
    color: "#fbbf24",
    inputPrice: 2.0,
    outputPrice: 6.0,
    maxInstances: 3,
  },

  // DeepSeek
  {
    id: "deepseek-v4-pro",
    fullName: "deepseek/deepseek-v4-pro",
    provider: "deepseek",
    color: "#60a5fa",
    inputPrice: 0.435,
    outputPrice: 0.87,
  },

  // Zhipu AI
  {
    id: "glm-4.7-flash",
    fullName: "zai/glm-4.7-flash",
    provider: "zhipu",
    color: "#34d399",
    inputPrice: 0.07,
    outputPrice: 0.4,
  },
  {
    id: "glm-5.2",
    fullName: "zai/glm-5.2",
    provider: "zhipu",
    color: "#34d399",
    inputPrice: 1.4,
    outputPrice: 4.4,
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
