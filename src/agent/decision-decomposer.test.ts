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
          {
            id: "topdeck_card",
            label: "Topdeck",
            color: "#10B981",
            isDefault: false,
          },
          {
            id: "trash_card",
            label: "Trash",
            color: "#EF4444",
            isDefault: false,
          },
          {
            id: "discard_card",
            label: "Discard",
            color: "#9CA3AF",
            isDefault: true,
          },
        ],
        intent: "topdeck",
        cardBeingPlayed: "Sentry",
        presentation: { currentRoundIndex: 0 },
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
          {
            id: "topdeck_card",
            label: "Topdeck",
            color: "#10B981",
            isDefault: false,
          },
          {
            id: "trash_card",
            label: "Trash",
            color: "#EF4444",
            isDefault: false,
          },
          {
            id: "discard_card",
            label: "Discard",
            color: "#9CA3AF",
            isDefault: true,
          },
        ],
        intent: "topdeck",
        cardBeingPlayed: "Sentry",
        presentation: { currentRoundIndex: 1 },
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
          {
            id: "topdeck_card",
            label: "Topdeck",
            color: "#10B981",
            isDefault: false,
          },
          {
            id: "trash_card",
            label: "Trash",
            color: "#EF4444",
            isDefault: false,
          },
        ],
        intent: "topdeck",
        cardBeingPlayed: "Sentry",
        presentation: { currentRoundIndex: 5 }, // Out of bounds
      };

      const result = decomposeDecisionForAI(decision);

      expect(result).toEqual([{ type: "skip_decision" }]);
    });

    it("should handle missing presentation with default round index 0", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Choose action for each card",
        min: 0,
        max: 1,
        cardOptions: ["Copper", "Silver"],
        actions: [
          {
            id: "topdeck_card",
            label: "Topdeck",
            color: "#10B981",
            isDefault: false,
          },
          {
            id: "discard_card",
            label: "Discard",
            color: "#9CA3AF",
            isDefault: true,
          },
        ],
        intent: "topdeck",
        cardBeingPlayed: "Sentry",
        // No presentation
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
          {
            id: "topdeck_card",
            label: "Topdeck",
            color: "#10B981",
            isDefault: false,
          },
        ],
        intent: "topdeck",
        cardBeingPlayed: "Sentry",
        presentation: { currentRoundIndex: 0 },
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
          { id: "select", label: "Select", color: "#10B981", isDefault: false },
          { id: "skip", label: "Skip", color: "#9CA3AF", isDefault: true },
        ],
        intent: "topdeck",
        cardBeingPlayed: "Sentry",
        presentation: { currentRoundIndex: 0 },
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
        cardBeingPlayed: "Chapel",
        min: 0,
        max: 4,
        cardOptions: ["Copper", "Copper", "Estate"],
        intent: "trash",
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
        cardBeingPlayed: "Cellar",
        min: 0,
        max: 3,
        cardOptions: ["Copper", "Silver", "Gold"],
        intent: "discard",
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
        cardBeingPlayed: "Workshop",
        min: 0,
        max: 2,
        cardOptions: ["Silver", "Estate"],
        intent: "gain",
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
        cardBeingPlayed: "Harbinger",
        min: 0,
        max: 2,
        cardOptions: ["Copper", "Silver"],
        intent: "topdeck",
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
        cardBeingPlayed: "Militia",
        min: 2,
        max: 2,
        cardOptions: ["Copper", "Silver", "Gold"],
        intent: "discard",
        from: "hand",
      };

      const result = decomposeDecisionForAI(decision);

      expect(result.length).toBe(3); // 3 cards, no skip
      expect(result).toContainEqual({ type: "discard_card", card: "Copper" });
      expect(result).toContainEqual({ type: "discard_card", card: "Silver" });
      expect(result).toContainEqual({ type: "discard_card", card: "Gold" });
      expect(result).not.toContainEqual({ type: "skip_decision" });
    });

    it("should handle discard intent for an opponent", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Discard down to 3",
        cardBeingPlayed: "Militia",
        min: 1,
        max: 2,
        cardOptions: ["Copper", "Estate"],
        intent: "discard",
        from: "hand",
      };

      const result = decomposeDecisionForAI(decision);

      expect(result.length).toBe(2); // 2 cards, no skip (min=1)
      expect(result).toContainEqual({ type: "discard_card", card: "Copper" });
      expect(result).toContainEqual({ type: "discard_card", card: "Estate" });
    });

    it("should handle trash intent for a victim", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Trash a treasure",
        cardBeingPlayed: "Bandit",
        min: 1,
        max: 1, // Single card decision - not decomposed
        cardOptions: ["Copper", "Silver"],
        intent: "trash",
        from: "hand",
      };

      const result = decomposeDecisionForAI(decision);

      // Single card decisions (max=1) are not decomposed
      expect(result).toEqual([]);
    });

    it("should handle topdeck intent for an opponent", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Topdeck a victory card",
        cardBeingPlayed: "Bureaucrat",
        min: 0,
        max: 1, // Single card decision - not decomposed
        cardOptions: ["Estate", "Duchy"],
        intent: "topdeck",
        from: "hand",
      };

      const result = decomposeDecisionForAI(decision);

      // Single card decisions (max=1) are not decomposed
      expect(result).toEqual([]);
    });

    it("should throw error for unsupported batch intent", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Unknown intent",
        cardBeingPlayed: "Chapel",
        min: 0,
        max: 2,
        cardOptions: ["Copper"],
        intent: "select",
        from: "hand",
      };

      expect(() => decomposeDecisionForAI(decision)).toThrow(
        "Unknown batch decision intent: select",
      );
    });
  });

  describe("single-card decisions", () => {
    it("should return empty array for single card decision (max=1)", () => {
      const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
        choiceType: "decision",
        playerId: "player1",
        prompt: "Trash a card",
        cardBeingPlayed: "Chapel",
        min: 0,
        max: 1,
        cardOptions: ["Copper", "Silver"],
        intent: "trash",
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
        cardBeingPlayed: "Workshop",
        min: 0,
        // max omitted (single card)
        cardOptions: ["Silver", "Estate"],
        intent: "gain",
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
        cardBeingPlayed: "Chapel",
        min: 0,
        max: 4,
        cardOptions: [],
        intent: "trash",
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
        cardBeingPlayed: "Chapel",
        min: 0,
        max: 0,
        cardOptions: ["Copper"],
        intent: "trash",
        from: "hand",
      };

      const result = decomposeDecisionForAI(decision);

      // max=0 means no batch decision
      expect(result).toEqual([]);
    });
  });
});
