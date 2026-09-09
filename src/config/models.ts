// Single source of truth for model configuration

export interface ModelConfig {
  id: string; // Short ID used in code (e.g., "claude-haiku")
  displayName: string; // Human-readable picker label
  fullName: string; // Full API name (e.g., "anthropic/claude-haiku-4.5")
  provider: string; // Provider name for grouping/coloring
  color: string; // UI color
  inputPrice: number; // Catalog base price per 1M input tokens in USD
  outputPrice: number; // Catalog base price per 1M output tokens in USD
  speed?: number; // Tokens per second (optional)
  gatewayProviders?: readonly string[]; // Restrict incompatible provider routes
  structuredOutput?: "prompt"; // For providers without native JSON schemas
  maxInstances?: number; // Max instances allowed in consensus (optional, default: unlimited)
}

// Verified 2026-09-09 against https://ai-gateway.vercel.sh/v1/models
// and /v1/models/{id}/endpoints (ZDR routes and live P50 latency).
// Includes the low-latency shortlist and current Flash/Lite families. Morph
// is excluded: it applies code edits rather than generating game actions.
// Prices are catalog base estimates; routed providers and tiers can differ.
// Enforce ZDR per request: some models also have non-ZDR providers.
export const MODELS = [
  // anthropic
  {
    id: "claude-haiku",
    fullName: "anthropic/claude-haiku-4.5",
    provider: "anthropic",
    color: "#a78bfa",
    displayName: "Claude Haiku",
    inputPrice: 1.0,
    outputPrice: 5.0,
  },
  {
    id: "claude-sonnet",
    fullName: "anthropic/claude-sonnet-5",
    provider: "anthropic",
    color: "#a78bfa",
    displayName: "Claude Sonnet",
    inputPrice: 2.0,
    outputPrice: 10.0,
  },
  {
    id: "claude-opus",
    fullName: "anthropic/claude-opus-4.8",
    provider: "anthropic",
    color: "#a78bfa",
    displayName: "Claude Opus",
    inputPrice: 5.0,
    outputPrice: 25.0,
    maxInstances: 3,
  },

  // openai
  {
    id: "gpt-oss-120b",
    fullName: "openai/gpt-oss-120b",
    provider: "openai",
    color: "#86efac",
    displayName: "GPT OSS 120B",
    inputPrice: 0.09999999999999999,
    outputPrice: 0.5,
  },
  {
    id: "gpt-5.4-nano",
    fullName: "openai/gpt-5.4-nano",
    provider: "openai",
    color: "#86efac",
    displayName: "GPT-5.4 Nano",
    inputPrice: 0.19999999999999998,
    outputPrice: 1.25,
  },
  {
    id: "gpt-5.4-mini",
    fullName: "openai/gpt-5.4-mini",
    provider: "openai",
    color: "#86efac",
    displayName: "GPT-5.4 Mini",
    inputPrice: 0.75,
    outputPrice: 4.5,
  },
  {
    id: "gpt-5.4",
    fullName: "openai/gpt-5.4",
    provider: "openai",
    color: "#86efac",
    displayName: "GPT-5.4",
    inputPrice: 2.5,
    outputPrice: 15.0,
    maxInstances: 3,
  },
  {
    id: "gpt-5.6-terra",
    fullName: "openai/gpt-5.6-terra",
    provider: "openai",
    color: "#86efac",
    displayName: "GPT-5.6 Terra",
    inputPrice: 2.0,
    outputPrice: 12.0,
    maxInstances: 3,
  },
  {
    id: "gpt-oss-20b",
    fullName: "openai/gpt-oss-20b",
    displayName: "GPT OSS 20B",
    provider: "openai",
    color: "#86efac",
    inputPrice: 0.05,
    outputPrice: 0.2,
  },

  // google
  {
    id: "gemini-3.1-flash-lite",
    fullName: "google/gemini-3.1-flash-lite",
    provider: "google",
    color: "#93c5fd",
    displayName: "Gemini 3.1 Flash Lite",
    inputPrice: 0.25,
    outputPrice: 1.5,
  },
  {
    id: "gemini-3.5-flash",
    fullName: "google/gemini-3.5-flash",
    provider: "google",
    color: "#93c5fd",
    displayName: "Gemini 3.5 Flash",
    inputPrice: 1.5,
    outputPrice: 9.0,
  },
  {
    id: "gemini-3.1-pro",
    fullName: "google/gemini-3.1-pro-preview",
    provider: "google",
    color: "#93c5fd",
    displayName: "Gemini 3.1 Pro",
    inputPrice: 2.0,
    outputPrice: 12.0,
    maxInstances: 3,
  },
  {
    id: "gemini-3.8-flash",
    fullName: "google/gemini-3.8-flash",
    displayName: "Gemini 3.8 Flash",
    provider: "google",
    color: "#93c5fd",
    inputPrice: 0.75,
    outputPrice: 3.75,
  },
  {
    id: "gemini-3.5-flash-lite",
    fullName: "google/gemini-3.5-flash-lite",
    displayName: "Gemini 3.5 Flash Lite",
    provider: "google",
    color: "#93c5fd",
    inputPrice: 0.3,
    outputPrice: 2.5,
  },

  // xai
  {
    id: "grok-4-fast",
    fullName: "spacexai/grok-4.1-fast-non-reasoning",
    provider: "xai",
    color: "#fbbf24",
    displayName: "Grok 4 Fast",
    inputPrice: 0.19999999999999998,
    outputPrice: 0.5,
  },

  // deepseek
  {
    id: "deepseek-v4-pro",
    fullName: "deepseek/deepseek-v4-pro",
    provider: "deepseek",
    color: "#60a5fa",
    displayName: "DeepSeek V4 Pro",
    inputPrice: 0.66,
    outputPrice: 1.9800000000000002,
  },
  {
    id: "deepseek-v4-flash",
    fullName: "deepseek/deepseek-v4-flash",
    displayName: "DeepSeek V4 Flash",
    provider: "deepseek",
    color: "#60a5fa",
    inputPrice: 0.13,
    outputPrice: 0.26,
  },
  {
    id: "deepseek-v4-flash-vision-exp",
    fullName: "deepseek/deepseek-v4-flash-vision-exp",
    displayName: "DeepSeek V4 Flash Vision Exp",
    provider: "deepseek",
    color: "#60a5fa",
    inputPrice: 0.22,
    outputPrice: 0.66,
  },
  {
    id: "deepseek-v4-pro-0813",
    fullName: "deepseek/deepseek-v4-pro-0813",
    displayName: "DeepSeek V4 Pro 0813",
    provider: "deepseek",
    color: "#60a5fa",
    inputPrice: 0.66,
    outputPrice: 1.98,
  },

  // zhipu
  {
    id: "glm-4.7-flash",
    fullName: "zai/glm-4.7-flash",
    provider: "zhipu",
    color: "#34d399",
    displayName: "GLM-4.7 Flash",
    inputPrice: 0.07,
    outputPrice: 0.39999999999999997,
  },
  {
    id: "glm-5.2",
    fullName: "zai/glm-5.2",
    provider: "zhipu",
    color: "#34d399",
    displayName: "GLM-5.2",
    inputPrice: 0.7999999999999999,
    outputPrice: 2.5500000000000003,
  },
  {
    id: "glm-4.7",
    fullName: "zai/glm-4.7",
    displayName: "GLM 4.7",
    provider: "zhipu",
    color: "#34d399",
    inputPrice: 0.6,
    outputPrice: 2.2,
  },
  {
    id: "glm-5.3",
    fullName: "zai/glm-5.3",
    displayName: "GLM 5.3",
    provider: "zhipu",
    color: "#34d399",
    inputPrice: 1.4,
    outputPrice: 4.4,
  },
  {
    id: "glm-5.3-flash",
    fullName: "zai/glm-5.3-flash",
    displayName: "GLM 5.3 Flash",
    provider: "zhipu",
    color: "#34d399",
    inputPrice: 0.15,
    outputPrice: 0.5,
  },
  {
    id: "glm-5.3-fast",
    fullName: "zai/glm-5.3-fast",
    displayName: "GLM 5.3 Fast",
    provider: "zhipu",
    color: "#34d399",
    inputPrice: 2.1,
    outputPrice: 6.6,
  },

  // alibaba
  {
    id: "qwen3.5-flash",
    fullName: "alibaba/qwen3.5-flash",
    provider: "alibaba",
    color: "#f97316",
    displayName: "Qwen 3.5 Flash",
    inputPrice: 0.09999999999999999,
    outputPrice: 0.39999999999999997,
  },
  {
    id: "qwen3-coder-30b-a3b",
    fullName: "alibaba/qwen3-coder-30b-a3b",
    displayName: "Qwen 3 Coder 30B A3B Instruct",
    provider: "alibaba",
    color: "#f97316",
    inputPrice: 0.15,
    outputPrice: 0.6,
  },
  {
    id: "qwen-3-30b",
    fullName: "alibaba/qwen-3-30b",
    displayName: "Qwen3-30B-A3B",
    provider: "alibaba",
    color: "#f97316",
    inputPrice: 0.12,
    outputPrice: 0.5,
  },
  {
    id: "qwen3.8-flash",
    fullName: "alibaba/qwen3.8-flash",
    displayName: "Qwen 3.8 Flash",
    provider: "alibaba",
    color: "#f97316",
    inputPrice: 0.16,
    outputPrice: 0.47,
  },
  {
    id: "qwen3.8-27b",
    fullName: "alibaba/qwen3.8-27b",
    displayName: "Qwen3.8 27B",
    provider: "alibaba",
    color: "#f97316",
    inputPrice: 0.5,
    outputPrice: 3.0,
  },
  {
    id: "qwen3.8-2.4t-a95b",
    fullName: "alibaba/qwen3.8-2.4t-a95b",
    displayName: "Qwen3.8 2.4T A95B",
    provider: "alibaba",
    color: "#f97316",
    inputPrice: 2.0,
    outputPrice: 6.0,
  },

  // meta
  {
    id: "muse-glimmer-30b",
    fullName: "meta/muse-glimmer-30b",
    displayName: "Muse Glimmer 30B",
    provider: "meta",
    color: "#818cf8",
    inputPrice: 0.35,
    outputPrice: 1.5,
  },
  {
    id: "llama-3.3-70b",
    structuredOutput: "prompt",
    fullName: "meta/llama-3.3-70b",
    displayName: "Llama 3.3 70B Instruct",
    provider: "meta",
    color: "#818cf8",
    inputPrice: 0.72,
    outputPrice: 0.72,
  },
  {
    id: "llama-4-maverick",
    fullName: "meta/llama-4-maverick",
    displayName: "Llama 4 Maverick 17B Instruct",
    provider: "meta",
    color: "#818cf8",
    inputPrice: 0.24,
    outputPrice: 0.97,
  },

  // nvidia
  {
    id: "nemotron-nano-9b-v2",
    structuredOutput: "prompt",
    // Bedrock returns malformed JSON for the game-choice protocol.
    gatewayProviders: ["deepinfra"],
    fullName: "nvidia/nemotron-nano-9b-v2",
    displayName: "Nvidia Nemotron Nano 9B V2",
    provider: "nvidia",
    color: "#a3e635",
    inputPrice: 0.06,
    outputPrice: 0.23,
  },
  {
    id: "nemotron-nano-12b-v2-vl",
    structuredOutput: "prompt",
    fullName: "nvidia/nemotron-nano-12b-v2-vl",
    displayName: "Nvidia Nemotron Nano 12B V2 VL",
    provider: "nvidia",
    color: "#a3e635",
    inputPrice: 0.2,
    outputPrice: 0.6,
  },
  {
    id: "nemotron-3-nano-30b-a3b",
    structuredOutput: "prompt",
    fullName: "nvidia/nemotron-3-nano-30b-a3b",
    displayName: "Nemotron 3 Nano 30B A3B",
    provider: "nvidia",
    color: "#a3e635",
    inputPrice: 0.05,
    outputPrice: 0.24,
  },
  {
    id: "nemotron-3.5-lightning",
    fullName: "nvidia/nemotron-3.5-lightning",
    displayName: "Nemotron 3.5 Lightning 30B",
    provider: "nvidia",
    color: "#a3e635",
    inputPrice: 0.05,
    outputPrice: 0.2,
  },
  {
    id: "nemotron-3-ultra-550b-a55b",
    fullName: "nvidia/nemotron-3-ultra-550b-a55b",
    displayName: "Nemotron 3 Ultra",
    provider: "nvidia",
    color: "#a3e635",
    inputPrice: 0.6,
    outputPrice: 2.4,
  },

  // stepfun
  {
    id: "step-3.5-flash",
    structuredOutput: "prompt",
    fullName: "stepfun/step-3.5-flash",
    displayName: "StepFun 3.5 Flash",
    provider: "stepfun",
    color: "#2dd4bf",
    inputPrice: 0.09,
    outputPrice: 0.3,
  },

  // moonshotai
  {
    id: "kimi-k3",
    fullName: "moonshotai/kimi-k3",
    displayName: "Kimi K3",
    provider: "moonshotai",
    color: "#e879f9",
    inputPrice: 3.0,
    outputPrice: 15.0,
  },

  // thinkingmachines
  {
    id: "inkling",
    fullName: "thinkingmachines/inkling",
    displayName: "Inkling",
    provider: "thinkingmachines",
    color: "#fb7185",
    inputPrice: 1.0,
    outputPrice: 4.05,
  },
  {
    id: "inkling-small",
    fullName: "thinkingmachines/inkling-small",
    displayName: "Inkling Small",
    provider: "thinkingmachines",
    color: "#fb7185",
    inputPrice: 0.5,
    outputPrice: 1.2,
  },

  // mistral
  {
    id: "ministral-3b",
    fullName: "mistral/ministral-3b",
    displayName: "Ministral 3B",
    provider: "mistral",
    color: "#fb923c",
    inputPrice: 0.1,
    outputPrice: 0.1,
  },
  {
    id: "ministral-8b",
    fullName: "mistral/ministral-8b",
    displayName: "Ministral 8B",
    provider: "mistral",
    color: "#fb923c",
    inputPrice: 0.15,
    outputPrice: 0.15,
  },
  {
    id: "ministral-14b",
    fullName: "mistral/ministral-14b",
    displayName: "Ministral 14B",
    provider: "mistral",
    color: "#fb923c",
    inputPrice: 0.2,
    outputPrice: 0.2,
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
