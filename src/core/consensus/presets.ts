import type { ModelProvider } from "../../config/models";

export interface ConsensusPreset {
  id: string;
  label: string;
  description: string;
  models: readonly ModelProvider[];
  consensusCount: number;
}

// Price axis, nothing else: the cheapest models that can carry a vote, at most
// two per house. Carrying a vote means zero failures and every sample under
// 20s, two thirds of the 30s timeout. The margin is the point: a model measured
// at 25s over three samples goes past 30s often enough to abstain, which is how
// step-3.5-flash looked right up until it did. consensusCount is an exact
// multiple of the list, so every model gets the same number of votes and no
// house holds more than a quarter of them.
const CHEAP_MODELS = [
  "jev",
  "nova-micro",
  "ministral-3b",
  "mistral-nemo",
  "nemotron-3.5-lightning",
  "nova-lite",
  "gpt-oss-120b",
  "grok-4-fast",
] as const satisfies readonly ModelProvider[];

// Latency axis, nothing else: the fastest models that can carry a vote,
// whatever they cost, at most two per house. This is also the default seat, so
// it is the roster a new game runs.
// consensusCount exceeds the list, so the four leading entries take the extra
// votes. They are ordered one house apiece for that reason: sorting strictly by
// latency would hand amazon a third of the vote through nova-micro and nova-lite
// together.
const FAST_MODELS = [
  "jev",
  "nova-micro",
  "gpt-4.1-mini-fast",
  "ministral-3b",
  "nova-lite",
  "nemotron-3-super-120b-a12b",
  "gemini-3.5-flash-lite",
  "nemotron-nano-12b-v2-vl",
] as const satisfies readonly ModelProvider[];

// The strongest model each house offers between $1 and $8 per million tokens:
// past the flash tier, nowhere near frontier price. Price is the only capability
// proxy the catalog carries, so the pick is the dearest of the band per house
// rather than the fastest, which is what keeps this preset from collapsing into
// Diverse.
const BALANCED_MODELS = [
  "nova-pro",
  "glm-4.7",
  "kimi-k2.5",
  "llama-3.3-70b",
  "mistral-large-3",
  "minimax-m3",
  "claude-haiku",
  "inkling",
] as const satisfies readonly ModelProvider[];

// One model per provider: the fastest of its house. Spread beats price here, a
// shared blind spot is what consensus voting is supposed to catch, and
// same-house models share theirs. Speed decides the pick because Diverse gives
// each house exactly one vote, and a vote past the 30s timeout is an abstention.
//
// Ranked from a live sweep on 2026-09-20: 3 samples per model through the real
// /api/generate-action path, 20 concurrent calls held constant. A model
// qualifies with zero failures and every sample under 20s, then takes the
// lowest median; medians within 15% count as a tie and price breaks it.
//
// Every house in the catalog is here except xiaomi, whose only surviving model
// medians 56s. presets.test.ts holds that list and fails on any provider the
// catalog offers that nobody has ruled on.
//
// Re-run the sweep after a catalog refresh rather than trusting these picks.
const DIVERSE_MODELS = [
  "jev",
  "nova-micro",
  "gpt-4.1-mini-fast",
  "ministral-3b",
  "nemotron-3-super-120b-a12b",
  "gemini-3.5-flash-lite",
  "inkling-small",
  "glm-4.7",
  "grok-4-fast",
  "qwen3-next-80b-a3b-instruct",
  "llama-4-maverick",
  "kimi-k2.5",
  "claude-3-haiku",
  "minimax-m3",
  "deepseek-v4.1-flash",
  "hy3",
] as const satisfies readonly ModelProvider[];

// The frontier flagship of each house that ships one inside the vote timeout.
// Expensive on purpose: this is the preset for when the answer matters more
// than the bill. One instance each, so the maxInstances caps never bind.
const PRO_MODELS = [
  "gpt-5.1-thinking-fast",
  "claude-sonnet",
  "gemini-3.1-pro",
  "qwen3.7-max",
  "kimi-k3-fast",
] as const satisfies readonly ModelProvider[];

export const JEV_PRESET: ConsensusPreset = {
  id: "jev",
  label: "Jev only",
  description: "One evaluation call, no voting",
  models: ["jev"],
  consensusCount: 1,
};

export const CHEAP_PRESET: ConsensusPreset = {
  id: "cheap",
  label: "Cheap",
  description: "Lowest price per vote, two votes each",
  models: CHEAP_MODELS,
  consensusCount: CHEAP_MODELS.length * 2,
};

export const FAST_PRESET: ConsensusPreset = {
  id: "fast",
  label: "Fast",
  description: "Cheap low-latency models, wide vote",
  models: FAST_MODELS,
  consensusCount: 12,
};

export const BALANCED_PRESET: ConsensusPreset = {
  id: "balanced",
  label: "Balanced",
  description: "Mid-tier models across providers, moderate cost",
  models: BALANCED_MODELS,
  consensusCount: BALANCED_MODELS.length,
};

export const DIVERSE_PRESET: ConsensusPreset = {
  id: "diverse",
  label: "Diverse",
  description: "One model per provider, one vote each",
  models: DIVERSE_MODELS,
  consensusCount: DIVERSE_MODELS.length,
};

export const PRO_PRESET: ConsensusPreset = {
  id: "pro",
  label: "Pro",
  description: "Frontier models, narrow vote",
  models: PRO_MODELS,
  consensusCount: 5,
};

export const CONSENSUS_PRESETS: readonly ConsensusPreset[] = [
  JEV_PRESET,
  CHEAP_PRESET,
  FAST_PRESET,
  BALANCED_PRESET,
  DIVERSE_PRESET,
  PRO_PRESET,
];
