import type { ModelProvider } from "../../config/models";

export interface ConsensusPreset {
  id: string;
  label: string;
  description: string;
  models: readonly ModelProvider[];
  consensusCount: number;
}

// Price axis, nothing else: the cheapest models that can carry a vote.
// Carrying a vote means zero failures and every sample under 20s, two thirds of
// the 30s timeout. The margin is the point: a model measured at 25s over three
// samples goes past 30s often enough to abstain, which is how step-3.5-flash
// looked right up until it did. consensusCount is an exact multiple of the list
// so every model gets the same number of votes.
const CHEAP_MODELS = [
  "jev",
  "nova-micro",
  "ministral-3b",
  "mistral-nemo",
  "nemotron-3.5-lightning",
  "nova-lite",
  "ministral-8b",
  "deepseek-v4-flash",
] as const satisfies readonly ModelProvider[];

// Latency axis, nothing else: the fastest models that can carry a vote,
// whatever they cost. This is also the default seat, so it is the roster a new
// game runs. consensusCount exceeds the list, so the leading entries take the
// extra votes: order is weighting.
const FAST_MODELS = [
  "jev",
  "nova-micro",
  "nova-lite",
  "gpt-4.1-mini-fast",
  "ministral-3b",
  "nemotron-3-super-120b-a12b",
  "gemini-3.5-flash-lite",
  "nova-pro",
] as const satisfies readonly ModelProvider[];

// The mid-tier flagship of eight houses: stronger than the flash tier, far
// under frontier price, and each verified to answer inside the vote timeout.
// One per provider, fastest first, so a house cannot dominate the vote.
const BALANCED_MODELS = [
  "nova-pro",
  "mistral-medium-3.5",
  "gpt-5.4-mini",
  "minimax-m3",
  "kimi-k2.6",
  "claude-haiku",
  "inkling",
  "qwen3.8-27b",
] as const satisfies readonly ModelProvider[];

// One model per provider: the fastest of its house. Spread beats price here, a
// shared blind spot is what consensus voting is supposed to catch, and
// same-house models share theirs. Speed decides the pick because Diverse gives
// each house exactly one vote, and a vote past the 30s timeout is an abstention.
//
// Ranked from a live sweep of all 186 catalog models on 2026-09-20: 3 samples
// each through the real /api/generate-action path, 20 concurrent calls held
// constant. A model qualifies with zero failures and no sample past 30s, then
// takes the lowest median, with every sample under 20s so there is margin
// against the timeout; medians within 15% count as a tie and price breaks it. Models specialised away from general answers (code completion, vision)
// are skipped for the same reason morph is denied outright.
//
// Three houses are absent on purpose: none of xiaomi, inclusionai or stepfun
// has a model that can carry a vote. presets.test.ts holds that list and fails on any
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
  "kimi-k2.5",
  "inkling-small",
  "ministral-3b",
  "nova-micro",
  "minimax-m3",
  "hy3",
] as const satisfies readonly ModelProvider[];

// The current frontier flagship of each house that ships one, verified to
// answer inside the vote timeout. Expensive on purpose: this is the preset for
// when the answer matters more than the bill. One instance each, so the
// maxInstances caps never bind.
const PRO_MODELS = [
  "claude-opus-5",
  "gpt-6-astra",
  "gemini-3.1-pro",
  "kimi-k3-fast",
  "qwen3.7-max",
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
