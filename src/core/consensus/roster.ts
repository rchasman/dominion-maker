import type { ModelConfig, ModelProvider } from "../../config/models";
import { MODEL_IDS, MODELS } from "../../config/models";
import type { LlmSeatConfig } from "../seats";
import { uiLogger } from "../../lib/logger";
import { FAST_PRESET } from "./presets";

const findModelConfig = (modelId: ModelProvider): ModelConfig | undefined =>
  MODELS.find(m => m.id === modelId);

export const AVAILABLE_MODELS: ModelProvider[] = [...MODEL_IDS];

type Tally = {
  models: ModelProvider[];
  instanceCounts: Map<ModelProvider, number>;
};

const withInstance = (acc: Tally, model: ModelProvider): Tally => ({
  models: [...acc.models, model],
  instanceCounts: new Map(acc.instanceCounts).set(
    model,
    (acc.instanceCounts.get(model) ?? 0) + 1,
  ),
});

const shuffle = <T>(items: T[]): T[] =>
  items.reduce<T[]>((shuffled, item, index) => {
    if (index === 0) return [item];
    const randomIndex = Math.floor(Math.random() * (index + 1));
    if (randomIndex === index) return [...shuffled, item];
    const displaced = shuffled[randomIndex];
    return displaced === undefined
      ? [...shuffled, item]
      : [
          ...shuffled.slice(0, randomIndex),
          item,
          displaced,
          ...shuffled.slice(randomIndex + 1),
        ];
  }, []);

/** Cycle the enabled models up to the count, honouring per-model instance limits, then shuffle */
function buildRosterFrom(
  enabledModels: ModelProvider[],
  consensusCount: number,
): ModelProvider[] {
  const enabled = Array.from(new Set(enabledModels));
  if (enabled.length === 0) {
    uiLogger.warn("No models enabled, falling back to the fast preset");
    return buildRosterFrom([...FAST_PRESET.models], FAST_PRESET.consensusCount);
  }
  const unlimited = enabled.filter(
    id => findModelConfig(id)?.maxInstances === undefined,
  );
  const underLimit = (acc: Tally) => (id: ModelProvider) => {
    const limit = findModelConfig(id)?.maxInstances;
    return limit === undefined || (acc.instanceCounts.get(id) ?? 0) < limit;
  };

  const { models } = Array.from(
    { length: consensusCount },
    (_, i) => i,
  ).reduce<Tally>(
    (acc, i) => {
      const candidate = enabled[i % enabled.length];
      if (candidate === undefined) {
        throw new Error("Model selection failed: no model available");
      }
      if (underLimit(acc)(candidate)) return withInstance(acc, candidate);
      const alternative = enabled.find(underLimit(acc));
      if (alternative) return withInstance(acc, alternative);
      const fallback = unlimited[i % (unlimited.length || 1)] ?? enabled[0];
      if (!fallback) throw new Error("No fallback model available");
      return withInstance(acc, fallback);
    },
    { models: [], instanceCounts: new Map() },
  );
  return shuffle(models);
}

/** A game without an `evaluate` step has nothing for an evaluation model to do */
export const buildRoster = (
  config: LlmSeatConfig,
  { allowEvaluation }: { allowEvaluation: boolean },
): ModelProvider[] =>
  buildRosterFrom(
    allowEvaluation
      ? config.models
      : config.models.filter(id => findModelConfig(id)?.evaluation === undefined),
    config.consensusCount,
  );
