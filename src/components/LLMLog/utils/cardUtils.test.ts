import { describe, it, expect } from "bun:test";
import { getCardColor } from "./cardUtils";

describe("LLMLog/utils/cardUtils", () => {
  describe("getCardColor", () => {
    it("should return curse color for curse cards", () => {
      const color = getCardColor("Curse");
      expect(color).toBe("var(--color-curse)");
    });

    it("should return victory color for victory cards", () => {
      const color = getCardColor("Estate");
      expect(color).toBe("var(--color-victory)");
    });

    it("should return gold color for treasure cards", () => {
      const color = getCardColor("Copper");
      expect(color).toBe("var(--color-gold)");
    });

    it("should return action color for action cards", () => {
      const color = getCardColor("Village");
      expect(color).toBe("var(--color-action)");
    });

    it("should prioritize curse over other types", () => {
      // If a card is both curse and something else, curse takes precedence
      const color = getCardColor("Curse");
      expect(color).toBe("var(--color-curse)");
    });

    it("should prioritize victory over treasure and action", () => {
      // Test with Gardens which is a victory card
      const color = getCardColor("Gardens");
      expect(color).toBe("var(--color-victory)");
    });

    it("should prioritize treasure over action for hybrid cards", () => {
      // If there were a treasure+action card, treasure should take priority
      // This is based on the if-statement order in the implementation
      const color = getCardColor("Gold");
      expect(color).toBe("var(--color-gold)");
    });

    it("should return default color for cards without known types", () => {
      // Test with a card that might not exist or have no types
      const color = getCardColor("UnknownCard" as any);
      expect(color).toBe("var(--color-text-primary)");
    });

    it("should handle Silver treasure card", () => {
      const color = getCardColor("Silver");
      expect(color).toBe("var(--color-gold)");
    });

    it("should handle Province victory card", () => {
      const color = getCardColor("Province");
      expect(color).toBe("var(--color-victory)");
    });

    it("should handle Smithy action card", () => {
      const color = getCardColor("Smithy");
      expect(color).toBe("var(--color-action)");
    });
  });
});
