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

describe("the diverse preset", () => {
  // Deliberate tripwire: adding a provider to MODELS must also update this preset.
  it("names every provider exactly once", () => {
    const providers = DIVERSE_PRESET.models.map(id => configOf(id)?.provider);
    expect(new Set(providers).size).toBe(providers.length);
    expect(new Set(providers)).toEqual(new Set(MODELS.map(m => m.provider)));
  });

  it("gives each provider one vote", () => {
    expect(DIVERSE_PRESET.consensusCount).toBe(DIVERSE_PRESET.models.length);
  });
});
