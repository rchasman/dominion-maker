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
  "anthropic/claude-haiku-5.5": "claude-haiku",
  "anthropic/claude-sonnet-5.5": "claude-sonnet",
  "google/gemini-3.1-pro-preview": "gemini-3.1-pro",
  "spacexai/grok-4.1-fast-non-reasoning": "grok-4-fast",
};

/**
 * /api/generate-action is open to anyone, so the catalog is the spending
 * limit: a model priced past this per decision is never offered or accepted.
 * A Dominion decision measured 3-5k input and 36-74 output tokens (2026-10-08).
 */
export const DECISION_TOKENS = { input: 4000, output: 100 };
export const MAX_DECISION_COST_USD = 0.02;

/** Models that reach the gateway but cannot play the game. */
export const DENIED_MODELS: Record<string, string> = {
  "openai/gpt-oss-20b":
    "leaks harmony markers under JSON response_format via the gateway",
  "anthropic/claude-opus-4": "failed all 3 live calls in the 2026-09-20 sweep",
  "deepseek/deepseek-r1": "failed all 3 live calls in the 2026-09-20 sweep",
  "zai/glm-4.6": "failed all 3 live calls in the 2026-09-20 sweep",
  "openai/gpt-5.4-pro": "failed all 3 live calls in the 2026-09-20 sweep",
  "moonshotai/kimi-k2-thinking":
    "failed all 3 live calls in the 2026-09-20 sweep",
  "meta/llama-3.1-8b": "failed all 3 live calls in the 2026-09-20 sweep",
  "xiaomi/mimo-v2.5": "failed all 3 live calls in the 2026-09-20 sweep",
  "alibaba/qwen-3-14b": "failed all 3 live calls in the 2026-09-20 sweep",
  "alibaba/qwen-3-30b": "failed all 3 live calls in the 2026-09-20 sweep",
  "alibaba/qwen3-vl-thinking":
    "failed all 3 live calls in the 2026-09-20 sweep",
  "alibaba/qwen3.8-max-0902": "failed all 3 live calls in the 2026-09-20 sweep",
  "alibaba/qwen-3.6-max-preview":
    "every live call past the 30s vote timeout (median 24s)",
  "alibaba/qwen3.6-plus":
    "every live call past the 30s vote timeout (median 20s)",
  "stepfun/step-3.5-flash":
    "went past the 30s vote timeout on 2 of 4 live calls",
  "mistral/mistral-large-4":
    "all 3 live calls past 35s in the 2026-10-08 sweep",
  "openai/gpt-5.5-pro": "1 of 3 live calls past 35s, median 26.5s, 2026-10-08",
  "openai/gpt-4-turbo":
    "the gateway refuses json_schema response_format for it, 2026-10-08",
  "openai/gpt-3.5-turbo":
    "the gateway refuses json_schema response_format for it, 2026-10-08",
  "nvidia/nemotron-nano-9b-v2":
    "its working route is gone; 0 of 3 legal replies in prompt mode, 2026-10-08",
  "nvidia/nemotron-3-nano-30b-a3b": "0 of 6 live calls inside 35s, 2026-10-08",
  "alibaba/qwen3.8-flash": "0 of 3 live calls inside 35s on rerun, 2026-10-08",
  "alibaba/qwen3.8-27b": "1 of 6 live calls inside 35s, 2026-10-08",
  "alibaba/qwen3.8-omni-flash": "1 of 6 live calls inside 35s, 2026-10-08",
  "alibaba/qwen3-235b-a22b-thinking":
    "3 of 6 live calls inside 35s, median 35s, 2026-10-08",
  "alibaba/qwen3-next-80b-a3b-thinking":
    "median 29s, at the 30s vote timeout, 2026-10-08",
  "alibaba/qwen3.7-flash": "median 32s, past the 30s vote timeout, 2026-10-08",
  "alibaba/qwen3.5-flash": "1 of 3 live calls inside 35s, 2026-10-08",
  "alibaba/qwen3.6-27b": "median 20s, max 25s, 2026-10-08",
  "deepseek/deepseek-v4-flash-vision-exp":
    "2 of 3 live calls inside 35s, median 22s, 2026-10-08",
};

/** A game move is text. Emitting an image or a video is a different job, and a
 *  model built for one answers a game prompt badly or not at all. */
export const GENERATOR_TAGS = ["image-generation", "video-generation"];

/** Trained for one narrow job that is not answering questions about a game:
 *  code completion and content moderation. Matched against the full model id. */
export const SPECIALIST_PATTERNS = [
  /codex/,
  /coder/,
  /codestral/,
  /-code($|-)/,
  /safeguard/,
  /moderation/,
  /-fin($|-)/,
];

/** Whole providers that do not answer game actions. */
export const DENIED_PROVIDERS: Record<string, string> = {
  morph: "applies code edits rather than generating game actions",
};

/**
 * Older releases kept alongside the newest of their class, the caret on a
 * version range. The newest of a class is usually the better model and rarely
 * the faster or cheaper one, and the presets rank on speed and price. Every
 * entry needs a measured reason.
 */
export const KEEP_VARIANTS: Record<string, string> = {
  "amazon/nova-lite": "1.4s and $0.30/1M against nova-2-lite's 1.7s and $2.80",
  "openai/gpt-4.1-mini-fast":
    "1.4s and $3.50/1M against gpt-5.4-mini-fast's 2.9s and $10.50",
  "moonshotai/kimi-k2.5":
    "2.0s and $3.60/1M against kimi-k3's 21.8s and $18.00",
  "zai/glm-4.7":
    "1.8s and $2.80/1M against glm-5.3's 13.5s, $5.80 and 1 failure in 3",
  "alibaba/qwen3.7-max":
    "answered 3 of 3 where the newer qwen3.8-max failed 2 of 3",
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
  fireworks: "#fdba74",
};

export const DEFAULT_PROVIDER_COLOR = "#94a3b8";

type ModelQuirks = {
  /** Providers without native JSON schema support need the prompt fallback */
  structuredOutput?: "prompt";
  /** Cap instances in one consensus round */
  maxInstances?: number;
};

/** Keyed by short id. Each entry is something a live run taught us. */
export const MODEL_QUIRKS: Record<string, ModelQuirks> = {
  "claude-opus-5.5": { maxInstances: 3 },
  "gpt-5.6-terra": { maxInstances: 3 },
  "gemini-3.1-pro": { maxInstances: 3 },
  "llama-3.3-70b": { structuredOutput: "prompt" },
  "llama-4-maverick": { structuredOutput: "prompt" },
  "nemotron-nano-12b-v2-vl": { structuredOutput: "prompt" },
};
