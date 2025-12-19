import { describe, it, expect } from "bun:test";
import { getCardColor } from "./card-colors";
import type { CardName } from "../types/game-state";

describe("card-colors", () => {
  describe("getCardColor", () => {
    it("returns curse color for Curse", () => {
      const color = getCardColor("Curse");
      expect(color).toBe("var(--color-curse)");
    });

    it("returns attack color for attack cards", () => {
      const color = getCardColor("Militia");
      expect(color).toBe("var(--color-attack)");
    });

    it("returns reaction color for reaction cards", () => {
      const color = getCardColor("Moat");
      expect(color).toBe("var(--color-reaction)");
    });

    it("returns treasure color for treasure cards", () => {
      const color = getCardColor("Copper");
      expect(color).toBe("var(--color-gold-bright)");
    });

    it("returns victory color for victory cards", () => {
      const color = getCardColor("Estate");
      expect(color).toBe("var(--color-victory)");
    });

    it("returns action color for action cards", () => {
      const color = getCardColor("Village");
      expect(color).toBe("var(--color-action)");
    });

    it("prioritizes curse over other types", () => {
      const color = getCardColor("Curse");
      expect(color).toBe("var(--color-curse)");
    });

    it("prioritizes attack over reaction", () => {
      const color = getCardColor("Militia");
      expect(color).toBe("var(--color-attack)");
    });

    it("handles Silver as treasure", () => {
      const color = getCardColor("Silver");
      expect(color).toBe("var(--color-gold-bright)");
    });

    it("handles Gold as treasure", () => {
      const color = getCardColor("Gold");
      expect(color).toBe("var(--color-gold-bright)");
    });

    it("handles Duchy as victory", () => {
      const color = getCardColor("Duchy");
      expect(color).toBe("var(--color-victory)");
    });

    it("handles Province as victory", () => {
      const color = getCardColor("Province");
      expect(color).toBe("var(--color-victory)");
    });

    it("handles Smithy as action", () => {
      const color = getCardColor("Smithy");
      expect(color).toBe("var(--color-action)");
    });

    it("returns default color for invalid card (error case)", () => {
      const color = getCardColor("InvalidCard" as any);
      expect(color).toBe("var(--color-text-primary)");
    });
  });
});
