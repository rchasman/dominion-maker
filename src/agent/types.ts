import type { ModelProvider } from "../config/models";
import { buildRosterFrom } from "../core/consensus/roster";

export { ALL_FAST_MODELS, AVAILABLE_MODELS } from "../core/consensus/roster";

// Model settings for consensus (replaced by per-seat LlmSeatConfig)
export interface ModelSettings {
  enabledModels: Set<ModelProvider>;
  consensusCount: number;
  customStrategy?: string;
}

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  enabledModels: new Set([
    "jev",
    "grok-4-fast",
    "gpt-5.4-nano",
    "gpt-5.4-mini",
    "gemini-3.1-flash-lite",
    "deepseek-v4-pro",
    "glm-4.7-flash",
    "qwen3.5-flash",
  ]),
  consensusCount: 12,
  customStrategy: "",
};

export function buildModelsFromSettings({
  enabledModels,
  consensusCount,
}: ModelSettings): ModelProvider[] {
  return buildRosterFrom(Array.from(enabledModels), consensusCount);
}
