import { describe, it, expect } from "bun:test";
import { decomposeDecisionForAI } from "./decision-decomposer";
import type { PendingChoice } from "../types/game-state";

describe("decomposeDecisionForAI", () => {
  describe("multi-action decisions (Sentry-style)", () => {
    it("should decompose Sentry decision for first card", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Choose action for each card",
        min: 0,
        max: 1,
        cardOptions: ["Copper", "Silver", "Gold"],
        actions: [
          { id: "topdeck_card", label: "Topdeck", isDefault: false },
          { id: "trash_card", label: "Trash", isDefault: false },
          { id: "discard_card", label: "Discard", isDefault: true },
        ],
        stage: "topdeck",
        from: "deck",
        metadata: { currentRoundIndex: 0 },
      };

      const result = decomposeDecisionForAI(decision);

      expect(result.length).toBe(4); // 3 actions + skip
      expect(result).toContainEqual({ type: "topdeck_card", card: "Copper" });
      expect(result).toContainEqual({ type: "trash_card", card: "Copper" });
      expect(result).toContainEqual({ type: "discard_card", card: "Copper" });
      expect(result).toContainEqual({ type: "skip_decision" });
    });

    it("should decompose Sentry decision for second card", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Choose action for each card",
        min: 0,
        max: 1,
        cardOptions: ["Copper", "Silver", "Gold"],
        actions: [
          { id: "topdeck_card", label: "Topdeck", isDefault: false },
          { id: "trash_card", label: "Trash", isDefault: false },
          { id: "discard_card", label: "Discard", isDefault: true },
        ],
        stage: "topdeck",
        from: "deck",
        metadata: { currentRoundIndex: 1 },
      };

      const result = decomposeDecisionForAI(decision);

      expect(result.length).toBe(4);
      expect(result).toContainEqual({ type: "topdeck_card", card: "Silver" });
      expect(result).toContainEqual({ type: "trash_card", card: "Silver" });
      expect(result).toContainEqual({ type: "discard_card", card: "Silver" });
      expect(result).toContainEqual({ type: "skip_decision" });
    });

    it("should return skip_decision when round index out of bounds", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Choose action for each card",
        min: 0,
        max: 1,
        cardOptions: ["Copper", "Silver"],
        actions: [
          { id: "topdeck_card", label: "Topdeck", isDefault: false },
          { id: "trash_card", label: "Trash", isDefault: false },
        ],
        stage: "topdeck",
        from: "deck",
        metadata: { currentRoundIndex: 5 }, // Out of bounds
      };

      const result = decomposeDecisionForAI(decision);

      expect(result).toEqual([{ type: "skip_decision" }]);
    });

    it("should handle missing metadata with default round index 0", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Choose action for each card",
        min: 0,
        max: 1,
        cardOptions: ["Copper", "Silver"],
        actions: [
          { id: "topdeck_card", label: "Topdeck", isDefault: false },
          { id: "discard_card", label: "Discard", isDefault: true },
        ],
        stage: "topdeck",
        from: "deck",
        // No metadata
      };

      const result = decomposeDecisionForAI(decision);

      expect(result.length).toBe(3); // 2 actions + skip
      expect(result).toContainEqual({ type: "topdeck_card", card: "Copper" });
      expect(result).toContainEqual({ type: "discard_card", card: "Copper" });
      expect(result).toContainEqual({ type: "skip_decision" });
    });

    it("should return skip_decision when card not found at index", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Choose action for each card",
        min: 0,
        max: 1,
        cardOptions: [], // Empty options
        actions: [
          { id: "topdeck_card", label: "Topdeck", isDefault: false },
        ],
        stage: "topdeck",
        from: "deck",
        metadata: { currentRoundIndex: 0 },
      };

      const result = decomposeDecisionForAI(decision);

      expect(result).toEqual([{ type: "skip_decision" }]);
    });

    it("should ignore select/skip actions in multi-action decisions", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Choose action for each card",
        min: 0,
        max: 1,
        cardOptions: ["Copper"],
        actions: [
          { id: "select", label: "Select", isDefault: false },
          { id: "skip", label: "Skip", isDefault: true },
        ],
        stage: "topdeck",
        from: "deck",
        metadata: { currentRoundIndex: 0 },
      };

      const result = decomposeDecisionForAI(decision);

      // Should not be treated as multi-action (only select/skip)
      expect(result).toEqual([]);
    });
  });

  describe("batch decisions (Chapel/Cellar-style)", () => {
    it("should decompose trash batch decision", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Trash up to 4 cards",
        min: 0,
        max: 4,
        cardOptions: ["Copper", "Copper", "Estate"],
        stage: "trash",
        from: "hand",
      };

      const result = decomposeDecisionForAI(decision);

      expect(result.length).toBe(4); // 3 cards + skip
      expect(result).toContainEqual({ type: "trash_card", card: "Copper" });
      expect(result).toContainEqual({ type: "trash_card", card: "Estate" });
      expect(result).toContainEqual({ type: "skip_decision" });
    });

    it("should decompose discard batch decision", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Discard cards",
        min: 0,
        max: 3,
        cardOptions: ["Copper", "Silver", "Gold"],
        stage: "discard",
        from: "hand",
      };

      const result = decomposeDecisionForAI(decision);

      expect(result.length).toBe(4); // 3 cards + skip
      expect(result).toContainEqual({ type: "discard_card", card: "Copper" });
      expect(result).toContainEqual({ type: "discard_card", card: "Silver" });
      expect(result).toContainEqual({ type: "discard_card", card: "Gold" });
      expect(result).toContainEqual({ type: "skip_decision" });
    });

    it("should decompose gain batch decision", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Gain cards",
        min: 0,
        max: 2,
        cardOptions: ["Silver", "Estate"],
        stage: "gain",
        from: "supply",
      };

      const result = decomposeDecisionForAI(decision);

      expect(result.length).toBe(3); // 2 cards + skip
      expect(result).toContainEqual({ type: "gain_card", card: "Silver" });
      expect(result).toContainEqual({ type: "gain_card", card: "Estate" });
      expect(result).toContainEqual({ type: "skip_decision" });
    });

    it("should decompose topdeck batch decision", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Topdeck cards",
        min: 0,
        max: 2,
        cardOptions: ["Copper", "Silver"],
        stage: "topdeck",
        from: "discard",
      };

      const result = decomposeDecisionForAI(decision);

      expect(result.length).toBe(3); // 2 cards + skip
      expect(result).toContainEqual({ type: "topdeck_card", card: "Copper" });
      expect(result).toContainEqual({ type: "topdeck_card", card: "Silver" });
      expect(result).toContainEqual({ type: "skip_decision" });
    });

    it("should not include skip when min > 0", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Discard exactly 2 cards",
        min: 2,
        max: 2,
        cardOptions: ["Copper", "Silver", "Gold"],
        stage: "discard",
        from: "hand",
      };

      const result = decomposeDecisionForAI(decision);

      expect(result.length).toBe(3); // 3 cards, no skip
      expect(result).toContainEqual({ type: "discard_card", card: "Copper" });
      expect(result).toContainEqual({ type: "discard_card", card: "Silver" });
      expect(result).toContainEqual({ type: "discard_card", card: "Gold" });
      expect(result).not.toContainEqual({ type: "skip_decision" });
    });

    it("should handle opponent_discard stage", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Discard down to 3",
        min: 1,
        max: 2,
        cardOptions: ["Copper", "Estate"],
        stage: "opponent_discard",
        from: "hand",
      };

      const result = decomposeDecisionForAI(decision);

      expect(result.length).toBe(2); // 2 cards, no skip (min=1)
      expect(result).toContainEqual({ type: "discard_card", card: "Copper" });
      expect(result).toContainEqual({ type: "discard_card", card: "Estate" });
    });

    it("should handle victim_trash_choice stage", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Trash a treasure",
        min: 1,
        max: 1, // Single card decision - not decomposed
        cardOptions: ["Copper", "Silver"],
        stage: "victim_trash_choice",
        from: "hand",
      };

      const result = decomposeDecisionForAI(decision);

      // Single card decisions (max=1) are not decomposed
      expect(result).toEqual([]);
    });

    it("should handle opponent_topdeck stage", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Topdeck a victory card",
        min: 0,
        max: 1, // Single card decision - not decomposed
        cardOptions: ["Estate", "Duchy"],
        stage: "opponent_topdeck",
        from: "hand",
      };

      const result = decomposeDecisionForAI(decision);

      // Single card decisions (max=1) are not decomposed
      expect(result).toEqual([]);
    });

    it("should throw error for unknown batch stage", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Unknown stage",
        min: 0,
        max: 2,
        cardOptions: ["Copper"],
        stage: "unknown_stage" as any,
        from: "hand",
      };

      expect(() => decomposeDecisionForAI(decision)).toThrow(
        "Unknown batch decision stage: unknown_stage",
      );
    });
  });

  describe("single-card decisions", () => {
    it("should return empty array for single card decision (max=1)", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Trash a card",
        min: 0,
        max: 1,
        cardOptions: ["Copper", "Silver"],
        stage: "trash",
        from: "hand",
      };

      const result = decomposeDecisionForAI(decision);

      // Single card decisions are not decomposed
      expect(result).toEqual([]);
    });

    it("should return empty array for max=undefined (single card)", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Gain a card",
        min: 0,
        max: undefined,
        cardOptions: ["Silver", "Estate"],
        stage: "gain",
        from: "supply",
      };

      const result = decomposeDecisionForAI(decision);

      expect(result).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("should handle empty cardOptions", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Trash cards",
        min: 0,
        max: 4,
        cardOptions: [],
        stage: "trash",
        from: "hand",
      };

      const result = decomposeDecisionForAI(decision);

      expect(result).toEqual([{ type: "skip_decision" }]);
    });

    it("should handle max=0", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "No cards to select",
        min: 0,
        max: 0,
        cardOptions: ["Copper"],
        stage: "trash",
        from: "hand",
      };

      const result = decomposeDecisionForAI(decision);

      // max=0 means no batch decision
      expect(result).toEqual([]);
    });
  });
});
