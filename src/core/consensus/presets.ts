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

// One model per provider. Spread beats price here: a shared blind spot is what
// consensus voting is supposed to catch, and same-house models share theirs.
const DIVERSE_MODELS = [
  "jev",
  "claude-haiku",
  "gpt-5.4-mini",
  "gemini-3.5-flash",
  "grok-4-fast",
  "deepseek-v4-pro",
  "glm-5.2",
  "qwen3.8-flash",
  "llama-4-maverick",
  "nemotron-3.5-lightning",
  "step-3.5-flash",
  "kimi-k3",
  "inkling-small",
  "ministral-8b",
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
