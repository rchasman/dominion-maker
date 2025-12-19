import { describe, it, expect } from "bun:test";
import { canSkipDecision, shouldSelectCard } from "./decision-utils";
import type { GameState } from "../types/game-state";

describe("decision-utils", () => {
  describe("canSkipDecision", () => {
    it("returns true when decision has min = 0", () => {
      const decision: GameState["pendingChoice"] = {
        choiceType: "decision",
        playerId: "human",
        prompt: "Choose cards",
        cards: ["Copper", "Silver"],
        min: 0,
        max: 2,
      };
      expect(canSkipDecision(decision)).toBe(true);
    });

    it("returns false when decision has min = 1", () => {
      const decision: GameState["pendingChoice"] = {
        choiceType: "decision",
        playerId: "human",
        prompt: "Choose cards",
        cards: ["Copper", "Silver"],
        min: 1,
        max: 2,
      };
      expect(canSkipDecision(decision)).toBe(false);
    });

    it("returns false when decision has min = undefined (defaults to 1)", () => {
      const decision: GameState["pendingChoice"] = {
        choiceType: "decision",
        playerId: "human",
        prompt: "Choose cards",
        cards: ["Copper", "Silver"],
        max: 2,
      };
      expect(canSkipDecision(decision)).toBe(false);
    });

    it("returns false when pendingChoice is reaction", () => {
      const decision: GameState["pendingChoice"] = {
        choiceType: "reaction",
        playerId: "human",
        cards: ["Moat"],
      };
      expect(canSkipDecision(decision)).toBe(false);
    });

    it("returns false when pendingChoice is null", () => {
      const decision: GameState["pendingChoice"] = null;
      expect(canSkipDecision(decision)).toBe(false);
    });

    it("returns false when min is greater than 0", () => {
      const decision: GameState["pendingChoice"] = {
        choiceType: "decision",
        playerId: "human",
        prompt: "Choose cards",
        cards: ["Copper", "Silver"],
        min: 2,
        max: 2,
      };
      expect(canSkipDecision(decision)).toBe(false);
    });
  });

  describe("shouldSelectCard", () => {
    it("returns shouldToggleOff=true when card is already selected", () => {
      const pendingChoice: GameState["pendingChoice"] = {
        choiceType: "decision",
        playerId: "human",
        prompt: "Choose cards",
        cards: ["Copper", "Silver"],
        min: 0,
        max: 2,
      };
      const result = shouldSelectCard(0, [0, 1], pendingChoice);
      expect(result.shouldToggleOff).toBe(true);
      expect(result.canAdd).toBe(false);
    });

    it("returns canAdd=true when card is not selected and below max", () => {
      const pendingChoice: GameState["pendingChoice"] = {
        choiceType: "decision",
        playerId: "human",
        prompt: "Choose cards",
        cards: ["Copper", "Silver"],
        min: 0,
        max: 2,
      };
      const result = shouldSelectCard(1, [0], pendingChoice);
      expect(result.shouldToggleOff).toBe(false);
      expect(result.canAdd).toBe(true);
    });

    it("returns canAdd=false when at max selections", () => {
      const pendingChoice: GameState["pendingChoice"] = {
        choiceType: "decision",
        playerId: "human",
        prompt: "Choose cards",
        cards: ["Copper", "Silver", "Gold"],
        min: 0,
        max: 2,
      };
      const result = shouldSelectCard(2, [0, 1], pendingChoice);
      expect(result.shouldToggleOff).toBe(false);
      expect(result.canAdd).toBe(false);
    });

    it("uses default max of 999 when max is undefined", () => {
      const pendingChoice: GameState["pendingChoice"] = {
        choiceType: "decision",
        playerId: "human",
        prompt: "Choose cards",
        cards: ["Copper", "Silver"],
        min: 0,
      };
      const result = shouldSelectCard(1, [], pendingChoice);
      expect(result.canAdd).toBe(true);
    });

    it("handles reaction pendingChoice (uses default max)", () => {
      const pendingChoice: GameState["pendingChoice"] = {
        choiceType: "reaction",
        playerId: "human",
        cards: ["Moat"],
      };
      const result = shouldSelectCard(0, [], pendingChoice);
      expect(result.canAdd).toBe(true);
    });

    it("handles null pendingChoice (uses default max)", () => {
      const pendingChoice: GameState["pendingChoice"] = null;
      const result = shouldSelectCard(0, [], pendingChoice);
      expect(result.canAdd).toBe(true);
    });

    it("handles empty selection array", () => {
      const pendingChoice: GameState["pendingChoice"] = {
        choiceType: "decision",
        playerId: "human",
        prompt: "Choose cards",
        cards: ["Copper"],
        min: 0,
        max: 1,
      };
      const result = shouldSelectCard(0, [], pendingChoice);
      expect(result.shouldToggleOff).toBe(false);
      expect(result.canAdd).toBe(true);
    });
  });
});
