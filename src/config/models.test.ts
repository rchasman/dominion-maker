import { describe, it, expect } from "bun:test";
import {
  getModelColor,
  getProviderColor,
  getModelFullName,
  MODEL_MAP,
  PROVIDER_COLORS,
  MODELS,
} from "./models";
import {
  DENIED_MODELS,
  DENIED_PROVIDERS,
  ID_ALIASES,
  MODEL_QUIRKS,
  PROVIDER_COLORS_BY_NAME,
  SPECIALIST_PATTERNS,
} from "./model-overrides";

describe("Model Configuration", () => {
  describe("getModelColor", () => {
    it("should return color for valid model ID", () => {
      expect(getModelColor("claude-haiku")).toBe("#a78bfa");
      expect(getModelColor("gpt-5.4-mini")).toBe("#86efac");
      expect(getModelColor("gemini-3.1-flash-lite")).toBe("#93c5fd");
    });

    it("should return fallback color for invalid model ID", () => {
      expect(getModelColor("invalid-model")).toBe(
        "var(--color-text-secondary)",
      );
      expect(getModelColor("")).toBe("var(--color-text-secondary)");
    });
  });

  describe("getProviderColor", () => {
    it("should return color for valid provider", () => {
      expect(getProviderColor("anthropic")).toBe("#a78bfa");
      expect(getProviderColor("openai")).toBe("#86efac");
      expect(getProviderColor("google")).toBe("#93c5fd");
      expect(getProviderColor("xai")).toBe("#fbbf24");
      expect(getProviderColor("deepseek")).toBe("#60a5fa");
      expect(getProviderColor("zhipu")).toBe("#34d399");
      expect(getProviderColor("alibaba")).toBe("#f97316");
    });

    it("should return fallback color for invalid provider", () => {
      expect(getProviderColor("unknown-provider")).toBe(
        "var(--color-text-secondary)",
      );
      expect(getProviderColor("")).toBe("var(--color-text-secondary)");
      expect(getProviderColor("fake")).toBe("var(--color-text-secondary)");
    });
  });

  describe("getModelFullName", () => {
    it("should return full name for valid model ID", () => {
      expect(getModelFullName("claude-haiku")).toBe(
        "anthropic/claude-haiku-4.5",
      );
      expect(getModelFullName("gpt-5.4-mini")).toBe("openai/gpt-5.4-mini");
      expect(getModelFullName("gemini-3.5-flash")).toBe(
        "google/gemini-3.5-flash",
      );
    });

    it("should return the input for invalid model ID", () => {
      expect(getModelFullName("invalid-model")).toBe("invalid-model");
      expect(getModelFullName("")).toBe("");
    });
  });

  describe("Model Data Integrity", () => {
    it("should have all models in MODEL_MAP", () => {
      for (const model of MODELS) {
        expect(MODEL_MAP[model.id]).toBe(model.fullName);
      }
    });

    it("should have all providers in PROVIDER_COLORS", () => {
      const uniqueProviders = [...new Set(MODELS.map(m => m.provider))];
      for (const provider of uniqueProviders) {
        expect(PROVIDER_COLORS[provider]).toBeDefined();
      }
    });

    it("should have valid price data for all models", () => {
      for (const model of MODELS) {
        expect(model.inputPrice).toBeGreaterThanOrEqual(0);
        expect(model.outputPrice).toBeGreaterThanOrEqual(0);
        expect(model.color).toBeDefined();
        expect(model.color.length).toBeGreaterThan(0);
      }
    });

    it("should have maxInstances for specific models", () => {
      const proModel = MODELS.find(m => m.id === "gpt-5.4");
      expect(proModel?.maxInstances).toBe(3);
    });
  });
});

describe("generated catalog and its overrides", () => {
  it("has no duplicate short ids", () => {
    const ids = MODELS.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contains nothing the overrides deny", () => {
    const denied = MODELS.filter(
      m =>
        DENIED_MODELS[m.fullName] !== undefined ||
        DENIED_PROVIDERS[m.provider] !== undefined,
    );
    expect(denied.map(m => m.id)).toEqual([]);
  });

  // A stale override is invisible otherwise: it silently stops applying when the
  // gateway renames or drops the model it keys off.
  it("has no override pointing at a model the gateway no longer offers", () => {
    const ids = new Set<string>(MODELS.map(m => m.id));
    const fullNames = new Set<string>(MODELS.map(m => m.fullName));
    expect(Object.keys(MODEL_QUIRKS).filter(id => !ids.has(id))).toEqual([]);
    expect(
      Object.keys(ID_ALIASES).filter(fullName => !fullNames.has(fullName)),
    ).toEqual([]);
  });

  // The first pass at this filter only asked whether a model *can* emit text,
  // which let image and video generators through: they emit both.
  it("lists no generator or single-purpose specialist", () => {
    const offenders = MODELS.filter(m =>
      SPECIALIST_PATTERNS.some(pattern => pattern.test(m.fullName)),
    );
    expect(offenders.map(m => m.id)).toEqual([]);
    expect(
      MODELS.filter(m => /-image($|-)|image-gen/.test(m.fullName)),
    ).toEqual([]);
  });

  it("keeps every provider spelling the picker knows how to colour", () => {
    const uncoloured = [...new Set(MODELS.map(m => m.provider))].filter(
      provider => PROVIDER_COLORS_BY_NAME[provider] === undefined,
    );
    expect(uncoloured).toEqual([]);
  });
});
