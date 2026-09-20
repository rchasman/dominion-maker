import type { ModelProvider } from "../../config/models";

export interface ConsensusPreset {
  id: string;
  label: string;
  description: string;
  models: readonly ModelProvider[];
  consensusCount: number;
}

// The bottom of the price list. consensusCount is an exact multiple of the
// length so every model gets the same number of votes.
const CHEAP_MODELS = [
  "jev",
  "nemotron-3.5-lightning",
  "ministral-3b",
  "glm-4.7-flash",
  "qwen3.5-flash",
  "gpt-oss-120b",
  "deepseek-v4-flash",
  "step-3.5-flash",
] as const satisfies readonly ModelProvider[];

// Cheap, low-latency models. consensusCount exceeds the list, so the leading
// entries take the extra votes: order is weighting.
const FAST_MODELS = [
  "jev",
  "grok-4-fast",
  "gpt-5.4-nano",
  "gpt-5.4-mini",
  "gemini-3.1-flash-lite",
  "deepseek-v4-pro",
  "glm-4.7-flash",
  "qwen3.5-flash",
] as const satisfies readonly ModelProvider[];

// Mid-tier models: better reasoning than the flash tier, far under frontier price.
const BALANCED_MODELS = [
  "claude-haiku",
  "gpt-5.4-mini",
  "gpt-5.6-terra",
  "gemini-3.5-flash",
  "glm-5.2",
  "deepseek-v4-pro",
  "qwen3.8-27b",
  "inkling",
] as const satisfies readonly ModelProvider[];

// One model per provider: the fastest of its house. Spread beats price here, a
// shared blind spot is what consensus voting is supposed to catch, and
// same-house models share theirs. Speed decides the pick because Diverse gives
// each house exactly one vote, and a vote past the 30s timeout is an abstention.
//
// Ranked from a live sweep of all 186 catalog models on 2026-09-20: 3 samples
// each through the real /api/generate-action path, 20 concurrent calls held
// constant. A model qualifies with zero failures and no sample past 30s, then
// takes the lowest median; medians within 15% count as a tie and price breaks
// it. Models specialised away from general answers (code completion, vision)
// are skipped for the same reason morph is denied outright.
//
// Two houses are absent on purpose: neither xiaomi nor inclusionai has a model
// that can carry a vote. presets.test.ts holds that list and fails on any
// provider the catalog offers that nobody has ruled on.
//
// Re-run the sweep after a catalog refresh rather than trusting these picks.
const DIVERSE_MODELS = [
  "jev",
  "claude-3-haiku",
  "gpt-4.1-mini-fast",
  "gemma-4-26b-a4b-it",
  "grok-4-fast",
  "deepseek-v4.1-flash",
  "glm-4.7",
  "qwen3-next-80b-a3b-instruct",
  "llama-4-maverick",
  "nemotron-3-super-120b-a12b",
  "step-3.5-flash",
  "kimi-k2.5",
  "inkling-small",
  "ministral-3b",
  "nova-micro",
  "minimax-m3",
  "hy3",
] as const satisfies readonly ModelProvider[];

// Frontier models. Most cap at 3 instances; claude-sonnet is uncapped and
// absorbs any overflow once the capped ones are full.
const PRO_MODELS = [
  "claude-opus",
  "claude-sonnet",
  "gpt-5.4",
  "gpt-5.6-terra",
  "gemini-3.1-pro",
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
