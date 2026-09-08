import { describe, it, expect } from "bun:test";
import { isDecisionChoice, isReactionChoice } from "./pending-choice";
import type { PendingChoice } from "./pending-choice";

describe("Type guards for PendingChoice", () => {
  describe("isDecisionChoice", () => {
    it("should return true for decision choice", () => {
      const choice: PendingChoice = {
        choiceType: "decision",
        playerId: "human",
        prompt: "Choose cards to discard",
        cardOptions: ["Copper", "Estate"],
        cardBeingPlayed: "Cellar",
      };

      expect(isDecisionChoice(choice)).toBe(true);
    });

    it("should return false for reaction choice", () => {
      const choice: PendingChoice = {
        choiceType: "reaction",
        playerId: "human",
        triggeringPlayerId: "ai",
        triggeringCard: "Militia",
        triggerType: "on_attack",
        availableReactions: ["Moat"],
      };

      expect(isDecisionChoice(choice)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isDecisionChoice(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isDecisionChoice(undefined)).toBe(false);
    });

    it("should narrow type correctly", () => {
      const choice: PendingChoice = {
        choiceType: "decision",
        playerId: "human",
        prompt: "Select a card",
        cardOptions: ["Village"],
        cardBeingPlayed: "Workshop",
      };

      if (isDecisionChoice(choice)) {
        // TypeScript should know this is a decision choice
        expect(choice.prompt).toBe("Select a card");
        expect(choice.cardBeingPlayed).toBe("Workshop");
      }
    });
  });

  describe("isReactionChoice", () => {
    it("should return true for reaction choice", () => {
      const choice: PendingChoice = {
        choiceType: "reaction",
        playerId: "human",
        triggeringPlayerId: "ai",
        triggeringCard: "Witch",
        triggerType: "on_attack",
        availableReactions: ["Moat"],
      };

      expect(isReactionChoice(choice)).toBe(true);
    });

    it("should return false for decision choice", () => {
      const choice: PendingChoice = {
        choiceType: "decision",
        playerId: "human",
        prompt: "Choose cards",
        cardOptions: ["Gold"],
        cardBeingPlayed: "Mine",
      };

      expect(isReactionChoice(choice)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isReactionChoice(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isReactionChoice(undefined)).toBe(false);
    });

    it("should narrow type correctly", () => {
      const choice: PendingChoice = {
        choiceType: "reaction",
        playerId: "human",
        triggeringPlayerId: "ai",
        triggeringCard: "Militia",
        triggerType: "on_attack",
        availableReactions: ["Moat"],
      };

      if (isReactionChoice(choice)) {
        // TypeScript should know this is a reaction choice
        expect(choice.triggeringCard).toBe("Militia");
        expect(choice.triggerType).toBe("on_attack");
        expect(choice.availableReactions).toEqual(["Moat"]);
      }
    });
  });

  describe("decision choice variants", () => {
    it("should handle decision with simple selection mode", () => {
      const choice: PendingChoice = {
        choiceType: "decision",
        playerId: "human",
        prompt: "Choose up to 2 cards",
        cardOptions: ["Copper", "Silver", "Gold"],
        cardBeingPlayed: "Chapel",
        from: "hand",
        min: 0,
        max: 2,
      };

      expect(isDecisionChoice(choice)).toBe(true);
      if (isDecisionChoice(choice)) {
        expect(choice.from).toBe("hand");
        expect(choice.max).toBe(2);
      }
    });

    it("should handle decision with complex multi-action mode", () => {
      const choice: PendingChoice = {
        choiceType: "decision",
        playerId: "human",
        prompt: "Choose cards and actions",
        cardOptions: ["Estate", "Curse"],
        cardBeingPlayed: "Sentry",
        actions: [
          { id: "trash_card", label: "Trash", color: "red" },
          { id: "discard_card", label: "Discard", color: "gray" },
          {
            id: "topdeck_card",
            label: "Return",
            color: "blue",
            isDefault: true,
          },
        ],
      };

      expect(isDecisionChoice(choice)).toBe(true);
      if (isDecisionChoice(choice)) {
        expect(choice.actions).toHaveLength(3);
        expect(choice.actions?.[2]?.isDefault).toBe(true);
      }
    });

    it("should handle decision with ordering requirement", () => {
      const choice: PendingChoice = {
        choiceType: "decision",
        playerId: "human",
        prompt: "Order cards to topdeck",
        cardOptions: ["Copper", "Silver"],
        cardBeingPlayed: "Sentry",
        requiresOrdering: true,
        orderingPrompt: "Choose the order (top to bottom)",
      };

      expect(isDecisionChoice(choice)).toBe(true);
      if (isDecisionChoice(choice)) {
        expect(choice.requiresOrdering).toBe(true);
        expect(choice.orderingPrompt).toContain("top to bottom");
      }
    });

    it("should handle decision with presentation", () => {
      const choice: PendingChoice = {
        choiceType: "decision",
        playerId: "human",
        prompt: "Choose a card",
        cardOptions: ["Province"],
        cardBeingPlayed: "Workshop",
        presentation: { currentRoundIndex: 1 },
      };

      expect(isDecisionChoice(choice)).toBe(true);
      if (isDecisionChoice(choice)) {
        expect(choice.presentation?.currentRoundIndex).toBe(1);
      }
    });
  });

  describe("reaction choice contract", () => {
    it("should expose the reaction trigger without attack bookkeeping", () => {
      const choice: PendingChoice = {
        choiceType: "reaction",
        playerId: "human",
        triggeringPlayerId: "ai",
        triggeringCard: "Militia",
        triggerType: "on_attack",
        availableReactions: ["Moat"],
      };

      expect(isReactionChoice(choice)).toBe(true);
      if (isReactionChoice(choice)) {
        expect(choice).not.toHaveProperty("metadata");
        expect(choice.triggerType).toBe("on_attack");
      }
    });

    it("should handle reaction with multiple available reactions", () => {
      const choice: PendingChoice = {
        choiceType: "reaction",
        playerId: "human",
        triggeringPlayerId: "ai",
        triggeringCard: "Witch",
        triggerType: "on_attack",
        availableReactions: ["Moat", "Chapel"],
      };

      expect(isReactionChoice(choice)).toBe(true);
      if (isReactionChoice(choice)) {
        expect(choice.availableReactions).toHaveLength(2);
        expect(choice.availableReactions).toContain("Moat");
        expect(choice.availableReactions).toContain("Chapel");
      }
    });
  });

  describe("type guard exhaustiveness", () => {
    it("should handle all decision choice fields", () => {
      const choice: PendingChoice = {
        choiceType: "decision",
        playerId: "test-player",
        prompt: "Test prompt",
        cardOptions: ["Copper", "Silver"],
        cardBeingPlayed: "Sentry",
        from: "supply",
        min: 1,
        max: 3,
        intent: "select",
        actions: [{ id: "select", label: "Select", color: "blue" }],
        requiresOrdering: true,
        orderingPrompt: "Order prompt",
        presentation: { currentRoundIndex: 0 },
      };

      if (isDecisionChoice(choice)) {
        expect(choice.playerId).toBe("test-player");
        expect(choice.intent).toBe("select");
        expect(choice.from).toBe("supply");
      }
    });

    it("should handle all reaction choice fields", () => {
      const choice: PendingChoice = {
        choiceType: "reaction",
        playerId: "test-player",
        triggeringPlayerId: "other-player",
        triggeringCard: "Militia",
        triggerType: "on_attack",
        availableReactions: ["Moat"],
      };

      if (isReactionChoice(choice)) {
        expect(choice.triggeringPlayerId).toBe("other-player");
        expect(choice.triggerType).toBe("on_attack");
        expect(choice.triggeringPlayerId).toBe("other-player");
      }
    });
  });
});
