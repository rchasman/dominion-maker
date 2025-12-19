import { describe, it, expect } from "bun:test";
import { canPlayCard, canBuyCards } from "./game-rules";
import type { GameState } from "../types/game-state";

describe("game-rules", () => {
  describe("canPlayCard", () => {
    it("allows playing action cards during action phase with actions available", () => {
      const result = canPlayCard("Village", "action", 1, true);
      expect(result.canPlayAction).toBe(true);
      expect(result.canPlayTreasure).toBe(false);
    });

    it("disallows playing action cards when no actions available", () => {
      const result = canPlayCard("Village", "action", 0, true);
      expect(result.canPlayAction).toBe(false);
    });

    it("disallows playing action cards during buy phase", () => {
      const result = canPlayCard("Village", "buy", 1, true);
      expect(result.canPlayAction).toBe(false);
    });

    it("allows playing treasure cards during buy phase", () => {
      const result = canPlayCard("Copper", "buy", 1, true);
      expect(result.canPlayTreasure).toBe(true);
      expect(result.canPlayAction).toBe(false);
    });

    it("disallows playing treasure cards during action phase", () => {
      const result = canPlayCard("Copper", "action", 1, true);
      expect(result.canPlayTreasure).toBe(false);
    });

    it("disallows all plays when not local player turn", () => {
      const result = canPlayCard("Village", "action", 1, false);
      expect(result.canPlayAction).toBe(false);
      expect(result.canPlayTreasure).toBe(false);
    });

    it("disallows playing non-action cards as actions", () => {
      const result = canPlayCard("Estate", "action", 1, true);
      expect(result.canPlayAction).toBe(false);
      expect(result.canPlayTreasure).toBe(false);
    });

    it("disallows playing non-treasure cards as treasures", () => {
      const result = canPlayCard("Estate", "buy", 1, true);
      expect(result.canPlayAction).toBe(false);
      expect(result.canPlayTreasure).toBe(false);
    });
  });

  describe("canBuyCards", () => {
    it("returns true when all conditions are met", () => {
      const result = canBuyCards(true, "buy", 1, false);
      expect(result).toBe(true);
    });

    it("returns false when not local player turn", () => {
      const result = canBuyCards(false, "buy", 1, false);
      expect(result).toBe(false);
    });

    it("returns false when not in buy phase", () => {
      const result = canBuyCards(true, "action", 1, false);
      expect(result).toBe(false);
    });

    it("returns false when no buys remaining", () => {
      const result = canBuyCards(true, "buy", 0, false);
      expect(result).toBe(false);
    });

    it("returns false when in preview mode", () => {
      const result = canBuyCards(true, "buy", 1, true);
      expect(result).toBe(false);
    });

    it("returns false when multiple conditions fail", () => {
      const result = canBuyCards(false, "action", 0, true);
      expect(result).toBe(false);
    });

    it("handles edge case of multiple buys", () => {
      const result = canBuyCards(true, "buy", 5, false);
      expect(result).toBe(true);
    });
  });
});
