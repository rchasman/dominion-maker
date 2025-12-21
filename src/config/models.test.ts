import { describe, it, expect } from "bun:test";
import {
  getModelColor,
  getProviderColor,
  getModelFullName,
  MODEL_MAP,
  PROVIDER_COLORS,
  MODELS,
} from "./models";

describe("Model Configuration", () => {
  describe("getModelColor", () => {
    it("should return color for valid model ID", () => {
      expect(getModelColor("claude-haiku")).toBe("#a78bfa");
      expect(getModelColor("gpt-4o-mini")).toBe("#86efac");
      expect(getModelColor("gemini-2.5-flash-lite")).toBe("#93c5fd");
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
      expect(getProviderColor("mistral")).toBe("#fda4af");
      expect(getProviderColor("xai")).toBe("#fbbf24");
      expect(getProviderColor("cerebras")).toBe("#f472b6");
      expect(getProviderColor("groq")).toBe("#fb923c");
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
      expect(getModelFullName("gpt-4o")).toBe("openai/gpt-4o");
      expect(getModelFullName("gemini-3-flash")).toBe("google/gemini-3-flash");
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

    it("should have speed data for specific models", () => {
      const modelWithSpeed = MODELS.find(
        m => m.id === "gemini-2.5-flash-lite",
      );
      expect(modelWithSpeed?.speed).toBe(496);

      const cerebrasModel = MODELS.find(m => m.id === "cerebras-llama-3.3-70b");
      expect(cerebrasModel?.speed).toBe(2130);
    });

    it("should have maxInstances for specific models", () => {
      const proModel = MODELS.find(m => m.id === "gpt-5.2-pro");
      expect(proModel?.maxInstances).toBe(3);
    });
  });
});
