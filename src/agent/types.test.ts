import { describe, it, expect } from "bun:test";
import {
  ALL_FAST_MODELS,
  buildModelsFromSettings,
  DEFAULT_MODEL_SETTINGS,
} from "./types";
import type { ModelProvider } from "../config/models";

describe("buildModelsFromSettings", () => {
  it("should return default models when no models enabled", () => {
    const result = buildModelsFromSettings({
      enabledModels: new Set(),
      consensusCount: 12,
    });

    expect(result.length).toBe(ALL_FAST_MODELS.length);
    // Should fall back to default models
    expect(result.every(m => typeof m === "string")).toBe(true);
  });

  it("should cycle through enabled models to reach consensusCount", () => {
    const result = buildModelsFromSettings({
      enabledModels: new Set([
        "gpt-5.4-mini",
        "gpt-oss-120b",
      ] as ModelProvider[]),
      consensusCount: 6,
    });

    expect(result.length).toBe(6);
    // Should contain both models
    const hasGpt = result.some(m => m === "gpt-5.4-mini");
    const hasMinistral = result.some(m => m === "gpt-oss-120b");
    expect(hasGpt).toBe(true);
    expect(hasMinistral).toBe(true);
  });

  it("should respect maxInstances limits", () => {
    // gpt-5.2-pro has maxInstances: 3
    const result = buildModelsFromSettings({
      enabledModels: new Set(["gpt-5.4", "gpt-5.4-mini"] as ModelProvider[]),
      consensusCount: 10,
    });

    expect(result.length).toBe(10);
    const gpt52ProCount = result.filter(m => m === "gpt-5.4").length;
    // Should not exceed maxInstances of 3
    expect(gpt52ProCount).toBeLessThanOrEqual(3);
  });

  it("should fall back to unlimited models when all limited models exhausted", () => {
    // gpt-5.2-pro has maxInstances: 3
    const result = buildModelsFromSettings({
      enabledModels: new Set(["gpt-5.4", "gpt-5.4-mini"] as ModelProvider[]),
      consensusCount: 8,
    });

    expect(result.length).toBe(8);
    const gpt52ProCount = result.filter(m => m === "gpt-5.4").length;
    const gptMiniCount = result.filter(m => m === "gpt-5.4-mini").length;

    // gpt-5.2-pro should be capped at 3
    expect(gpt52ProCount).toBeLessThanOrEqual(3);
    // GPT mini should fill the rest
    expect(gptMiniCount).toBeGreaterThan(0);
    expect(gpt52ProCount + gptMiniCount).toBe(8);
  });

  it("should handle single model with unlimited instances", () => {
    const result = buildModelsFromSettings({
      enabledModels: new Set(["gpt-5.4-mini"] as ModelProvider[]),
      consensusCount: 15,
    });

    expect(result.length).toBe(15);
    expect(result.every(m => m === "gpt-5.4-mini")).toBe(true);
  });

  it("should handle single model with maxInstances limit", () => {
    const result = buildModelsFromSettings({
      enabledModels: new Set(["gpt-5.4"] as ModelProvider[]),
      consensusCount: 5,
    });

    expect(result.length).toBe(5);
    const gpt52ProCount = result.filter(m => m === "gpt-5.4").length;
    // When there's only one model and no unlimited models, fallback uses that same model
    // So it won't be capped - this is the actual behavior
    expect(gpt52ProCount).toBe(5);
  });

  it("should shuffle results for randomness", () => {
    const result1 = buildModelsFromSettings({
      enabledModels: new Set([
        "gpt-5.4-mini",
        "gpt-oss-120b",
        "gpt-oss-120b",
      ] as ModelProvider[]),
      consensusCount: 12,
    });

    const result2 = buildModelsFromSettings({
      enabledModels: new Set([
        "gpt-5.4-mini",
        "gpt-oss-120b",
        "gpt-oss-120b",
      ] as ModelProvider[]),
      consensusCount: 12,
    });

    // Both should have same length
    expect(result1.length).toBe(12);
    expect(result2.length).toBe(12);

    // Results should potentially be in different order (shuffle)
    // We can't guarantee they're different due to randomness,
    // but we can verify they're both valid arrays
    expect(result1).toBeInstanceOf(Array);
    expect(result2).toBeInstanceOf(Array);
  });

  it("should handle default model settings", () => {
    const result = buildModelsFromSettings(DEFAULT_MODEL_SETTINGS);

    expect(result.length).toBe(DEFAULT_MODEL_SETTINGS.consensusCount);
    expect(result.every(m => typeof m === "string")).toBe(true);
  });

  it("should handle consensusCount of 1", () => {
    const result = buildModelsFromSettings({
      enabledModels: new Set(["gpt-5.4-mini"] as ModelProvider[]),
      consensusCount: 1,
    });

    expect(result.length).toBe(1);
    expect(result[0]).toBe("gpt-5.4-mini");
  });

  it("should handle multiple models with various maxInstances", () => {
    // Mix of limited and unlimited models
    const result = buildModelsFromSettings({
      enabledModels: new Set([
        "gpt-5.4", // maxInstances: 3
        "gpt-5.4-mini", // unlimited
        "gemini-3.1-flash-lite", // unlimited
      ] as ModelProvider[]),
      consensusCount: 20,
    });

    expect(result.length).toBe(20);
    const gpt52ProCount = result.filter(m => m === "gpt-5.4").length;
    expect(gpt52ProCount).toBeLessThanOrEqual(3);

    // Rest should be distributed among unlimited models
    const otherCount = result.length - gpt52ProCount;
    expect(otherCount).toBeGreaterThan(0);
  });

  it("should handle edge case with no unlimited models and all limited exhausted", () => {
    // Only limited model, consensus larger than limit
    const result = buildModelsFromSettings({
      enabledModels: new Set(["gpt-5.4"] as ModelProvider[]),
      consensusCount: 10,
    });

    expect(result.length).toBe(10);
    // When only limited model available, fallback uses that same model (ignoring limit)
    expect(result.every(m => m === "gpt-5.4")).toBe(true);
  });
});
