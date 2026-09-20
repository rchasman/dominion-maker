import { describe, it, expect } from "bun:test";
import { CONSENSUS_PRESETS, DIVERSE_PRESET } from "./presets";
import { buildRoster } from "./roster";
import { DEFAULT_LLM_SEAT } from "../seats";
import type { ModelConfig } from "../../config/models";
import { MODELS, MODEL_IDS } from "../../config/models";

const rosterFor = (preset: (typeof CONSENSUS_PRESETS)[number]) =>
  buildRoster({
    ...DEFAULT_LLM_SEAT,
    models: [...preset.models],
    consensusCount: preset.consensusCount,
  });

const configOf = (id: string): ModelConfig | undefined =>
  MODELS.find(m => m.id === id);

describe("consensus presets", () => {
  it("names only models that exist in the catalog", () => {
    const unknown = CONSENSUS_PRESETS.flatMap(preset =>
      preset.models.filter(id => !MODEL_IDS.includes(id)),
    );
    expect(unknown).toEqual([]);
  });

  it("builds a roster of the requested size for every preset", () => {
    CONSENSUS_PRESETS.forEach(preset => {
      expect(rosterFor(preset)).toHaveLength(preset.consensusCount);
    });
  });

  // Fast deliberately runs more votes than models, so its leading entries take
  // the extra ones. Every other preset must share the votes out evenly, or some
  // model is louder than the rest purely because of where it sits in the array.
  const UNEVEN_BY_DESIGN = new Set(["fast"]);

  it("weights every model equally", () => {
    CONSENSUS_PRESETS.filter(
      preset => !UNEVEN_BY_DESIGN.has(preset.id),
    ).forEach(preset => {
      expect(preset.consensusCount % preset.models.length).toBe(0);
      const perModel = preset.consensusCount / preset.models.length;
      const roster = rosterFor(preset);
      preset.models.forEach(id => {
        expect(roster.filter(m => m === id)).toHaveLength(perModel);
      });
    });
  });

  it("keeps every preset within each model's maxInstances cap", () => {
    CONSENSUS_PRESETS.forEach(preset => {
      const roster = rosterFor(preset);
      roster.forEach(id => {
        const cap = configOf(id)?.maxInstances;
        if (cap === undefined) return;
        expect(roster.filter(m => m === id).length).toBeLessThanOrEqual(cap);
      });
    });
  });
});

/**
 * Providers with no model that can carry a vote. Diverse gives each house one
 * vote and nothing else, so an unreliable pick means that house abstains.
 * A provider belongs here or in the preset, never neither.
 */
const DIVERSE_EXCLUDED_PROVIDERS: Record<string, string> = {
  xiaomi: "fastest model medians 56s, well past the 30s vote timeout",
  inclusionai: "its only model failed 6 of 12 live calls",
  stepfun: "its only model went past 30s on 2 of 4 live calls",
};

describe("the diverse preset", () => {
  const providersOf = (ids: readonly string[]) =>
    ids.map(id => configOf(id)?.provider);

  it("never votes the same provider twice", () => {
    const providers = providersOf(DIVERSE_PRESET.models);
    expect(new Set(providers).size).toBe(providers.length);
  });

  // Deliberate tripwire: a provider that appears in the catalog must either get
  // a pick here or an explicit reason it cannot carry a vote. A refresh that
  // adds a house fails this until someone measures it and decides.
  it("rules on every provider the catalog offers", () => {
    const catalog = new Set(MODELS.map(m => m.provider));
    const ruled = new Set([
      ...providersOf(DIVERSE_PRESET.models),
      ...Object.keys(DIVERSE_EXCLUDED_PROVIDERS),
    ]);
    expect([...catalog].filter(p => !ruled.has(p))).toEqual([]);
  });

  it("excludes no provider it also votes", () => {
    const voted = new Set(providersOf(DIVERSE_PRESET.models));
    expect(
      Object.keys(DIVERSE_EXCLUDED_PROVIDERS).filter(p => voted.has(p)),
    ).toEqual([]);
  });

  it("gives each provider one vote", () => {
    expect(DIVERSE_PRESET.consensusCount).toBe(DIVERSE_PRESET.models.length);
  });
});
