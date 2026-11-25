import type { ModelProvider } from "../../config/models";

export interface ConsensusPreset {
  id: string;
  label: string;
  description: string;
  models: readonly ModelProvider[];
  consensusCount: number;
}

// Carrying a vote, for every preset below, is measured on the 15 decision
// cases in src/agent/evals/jev-cases.ts sent through the real
// /api/generate-action path, 20 calls in flight (2026-11-25). It means zero
// failures, every answer under 20s (two thirds of the 30s timeout) and at
// least 13 acceptable picks. The latency margin is the point: a model measured
// at 25s goes past 30s often enough to abstain, which is how step-3.5-flash
// looked right up until it did. The pick floor keeps out models that answer
// fast and wrong: nova-lite picked acceptably 8 times in 15.
//
// Evaluation models (Jev and its kind) share one protocol and one gateway
// path, so they fail together. No preset with more than one model gives them
// more than half its votes.

// Price axis, nothing else: the cheapest models that can carry a vote, at most
// two per house. consensusCount is an exact
// multiple of the list, so every model gets the same number of votes and no
// house holds more than a quarter of them.
const CHEAP_MODELS = [
  "jev",
  "groundhog-1",
  "decision-1.1",
  "microsoft-decision-1",
  "ministral-3b",
  "gpt-6-luna",
  "gpt-oss-120b",
  "particle-1",
] as const satisfies readonly ModelProvider[];

// Latency axis, nothing else: the fastest models that can carry a vote,
// whatever they cost, at most two per house. This is also the default seat, so
// it is the roster a new game runs.
// consensusCount exceeds the list, so the four leading entries take the extra
// votes. They are ordered one house apiece for that reason, two evaluation
// models and two text models, so neither the leading house nor the evaluation
// path takes more than its share.
const FAST_MODELS = [
  "gpt-6-luna-decisions",
  "jev",
  "nemotron-3.5-super-vl",
  "deepseek-v4.1-flash-1017-ultrafast",
  "mammoth-1",
  "groundhog-1",
  "nemotron-3-ultra-550b-a55b",
  "ministral-3b",
] as const satisfies readonly ModelProvider[];

// The strongest model each house offers between $1 and $8 per million tokens:
// past the flash tier, nowhere near frontier price, measured on output price.
// The pick is the dearest of the band per house that carries a vote rather
// than the fastest, which is what keeps this preset from collapsing into
// Diverse. A house with no such model sits out (anthropic, thinkingmachines).
const BALANCED_MODELS = [
  "nova-pro",
  "glm-5.3",
  "kimi-k2.5",
  "muse-spark-open",
  "mistral-medium-3.5",
  "minimax-m3",
  "qwen4-max",
  "deepseek-v4.1-flash-1017-fast",
  "gemini-3.8-flash",
  "nemotron-3-ultra-550b-a55b",
  "o3",
  "grok-4.5",
] as const satisfies readonly ModelProvider[];

// One model per provider: the fastest of its house. Spread beats price here, a
// shared blind spot is what consensus voting is supposed to catch, and
// same-house models share theirs. Speed decides the pick because Diverse gives
// each house exactly one vote, and a vote past the 30s timeout is an abstention.
//
// Among the models that carry a vote, each house takes its lowest median;
// medians within 15% count as a tie, price breaks it, then acceptable picks.
//
// Every house in the catalog is here. presets.test.ts fails on any provider the
// catalog offers that nobody has ruled on.
//
// Re-run the sweep after a catalog refresh rather than trusting these picks.
const DIVERSE_MODELS = [
  "gpt-6-luna-decisions",
  "jev",
  "mammoth-1",
  "nemotron-3.5-super-vl",
  "ministral-3b",
  "minimax-m3",
  "decision-1.1",
  "deepseek-v4.1-flash-1017-fast",
  "grok-4.20-non-reasoning",
  "nova-pro",
  "gemma-4-31b-it",
  "glm-5.3",
  "particle-1",
  "claude-sonnet",
  "kimi-k2.5",
  "muse-spark-open",
  "qwen4-max",
] as const satisfies readonly ModelProvider[];

// The frontier flagship of each house that ships one inside the vote timeout.
// Expensive on purpose: this is the preset for when the answer matters more
// than the bill. One instance each, so the maxInstances caps never bind.
const PRO_MODELS = [
  "gpt-6.2-sol",
  "claude-sonnet",
  "gemini-3.1-pro",
  "qwen4-max",
  "kimi-k3.1-pro-highspeed",
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
