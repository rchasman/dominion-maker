// Everything about a model that the AI Gateway catalog cannot tell us.
// The gateway supplies ids, names, prices and ZDR status; these are the facts
// learned from running the models, plus the spellings this codebase already uses.

/** Gateway `owned_by` -> the provider spelling used across this codebase */
export const PROVIDER_ALIASES: Record<string, string> = {
  zai: "zhipu",
  spacexai: "xai",
  "typesafe-ai": "typesafe",
};

/** Short ids that predate the generator. Changing one breaks saved seat configs. */
export const ID_ALIASES: Record<string, string> = {
  "anthropic/claude-haiku-4.5": "claude-haiku",
  "anthropic/claude-sonnet-5": "claude-sonnet",
  "anthropic/claude-opus-4.8": "claude-opus",
  "google/gemini-3.1-pro-preview": "gemini-3.1-pro",
  "spacexai/grok-4.1-fast-non-reasoning": "grok-4-fast",
};

/** Models that reach the gateway but cannot play the game. */
export const DENIED_MODELS: Record<string, string> = {
  "openai/gpt-oss-20b":
    "leaks harmony markers under JSON response_format via the gateway",
};

/** Whole providers that do not answer game actions. */
export const DENIED_PROVIDERS: Record<string, string> = {
  morph: "applies code edits rather than generating game actions",
};

export const PROVIDER_COLORS_BY_NAME: Record<string, string> = {
  anthropic: "#a78bfa",
  openai: "#86efac",
  google: "#93c5fd",
  xai: "#fbbf24",
  deepseek: "#60a5fa",
  zhipu: "#34d399",
  alibaba: "#f97316",
  meta: "#818cf8",
  nvidia: "#a3e635",
  stepfun: "#2dd4bf",
  moonshotai: "#e879f9",
  thinkingmachines: "#fb7185",
  mistral: "#fb923c",
  typesafe: "#f472b6",
  amazon: "#facc15",
  minimax: "#c084fc",
  xiaomi: "#f87171",
  tencent: "#38bdf8",
  inclusionai: "#4ade80",
  arcee: "#94a3b8",
};

export const DEFAULT_PROVIDER_COLOR = "#94a3b8";

type ModelQuirks = {
  /** Providers without native JSON schema support need the prompt fallback */
  structuredOutput?: "prompt";
  /** Restrict incompatible gateway routes */
  gatewayProviders?: readonly string[];
  /** Cap instances in one consensus round */
  maxInstances?: number;
};

/** Keyed by short id. Each entry is something a live run taught us. */
export const MODEL_QUIRKS: Record<string, ModelQuirks> = {
  "claude-opus": { maxInstances: 3 },
  "gpt-5.4": { maxInstances: 3 },
  "gpt-5.6-terra": { maxInstances: 3 },
  "gemini-3.1-pro": { maxInstances: 3 },
  "llama-3.3-70b": { structuredOutput: "prompt" },
  "nemotron-nano-9b-v2": {
    structuredOutput: "prompt",
    // Bedrock returns malformed JSON for the game-choice protocol.
    gatewayProviders: ["deepinfra"],
  },
  "nemotron-nano-12b-v2-vl": { structuredOutput: "prompt" },
  "nemotron-3-nano-30b-a3b": { structuredOutput: "prompt" },
  "step-3.5-flash": { structuredOutput: "prompt" },
};
