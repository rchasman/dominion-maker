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
        metadata: {
          allTargets: ["human"],
          currentTargetIndex: 0,
          blockedTargets: [],
          originalCause: "Militia attack",
        },
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
        metadata: {
          allTargets: ["human", "player2"],
          currentTargetIndex: 0,
          blockedTargets: [],
          originalCause: "Witch attack",
        },
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
        metadata: {
          allTargets: ["human"],
          currentTargetIndex: 0,
          blockedTargets: [],
          originalCause: "Militia attack",
        },
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
          { id: "topdeck_card", label: "Return", color: "blue", isDefault: true },
        ],
      };

      expect(isDecisionChoice(choice)).toBe(true);
      if (isDecisionChoice(choice)) {
        expect(choice.actions).toHaveLength(3);
        expect(choice.actions?.[2].isDefault).toBe(true);
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

    it("should handle decision with metadata", () => {
      const choice: PendingChoice = {
        choiceType: "decision",
        playerId: "human",
        prompt: "Choose a card",
        cardOptions: ["Province"],
        cardBeingPlayed: "Workshop",
        metadata: {
          maxCost: 4,
          originalPrompt: "Gain a card",
        },
      };

      expect(isDecisionChoice(choice)).toBe(true);
      if (isDecisionChoice(choice)) {
        expect(choice.metadata?.maxCost).toBe(4);
      }
    });
  });

  describe("reaction choice with metadata", () => {
    it("should handle reaction with blocked targets", () => {
      const choice: PendingChoice = {
        choiceType: "reaction",
        playerId: "human",
        triggeringPlayerId: "ai",
        triggeringCard: "Militia",
        triggerType: "on_attack",
        availableReactions: ["Moat"],
        metadata: {
          allTargets: ["human", "player2", "player3"],
          currentTargetIndex: 1,
          blockedTargets: ["player2"],
          originalCause: "Militia attack targeting all opponents",
        },
      };

      expect(isReactionChoice(choice)).toBe(true);
      if (isReactionChoice(choice)) {
        expect(choice.metadata.blockedTargets).toContain("player2");
        expect(choice.metadata.currentTargetIndex).toBe(1);
      }
    });

    it("should handle reaction with multiple available reactions", () => {
      const choice: PendingChoice = {
        choiceType: "reaction",
        playerId: "human",
        triggeringPlayerId: "ai",
        triggeringCard: "Witch",
        triggerType: "on_attack",
        availableReactions: ["Moat", "Lighthouse"],
        metadata: {
          allTargets: ["human"],
          currentTargetIndex: 0,
          blockedTargets: [],
          originalCause: "Witch curse distribution",
        },
      };

      expect(isReactionChoice(choice)).toBe(true);
      if (isReactionChoice(choice)) {
        expect(choice.availableReactions).toHaveLength(2);
        expect(choice.availableReactions).toContain("Moat");
        expect(choice.availableReactions).toContain("Lighthouse");
      }
    });
  });

  describe("type guard exhaustiveness", () => {
    it("should handle all decision choice fields", () => {
      const choice: PendingChoice = {
        choiceType: "decision",
        playerId: "test-player",
        prompt: "Test prompt",
        cardOptions: ["Card1", "Card2"],
        cardBeingPlayed: "TestCard",
        from: "supply",
        min: 1,
        max: 3,
        stage: "test-stage",
        actions: [{ id: "select", label: "Select", color: "blue" }],
        requiresOrdering: true,
        orderingPrompt: "Order prompt",
        metadata: { test: "data" },
      };

      if (isDecisionChoice(choice)) {
        expect(choice.playerId).toBe("test-player");
        expect(choice.stage).toBe("test-stage");
        expect(choice.from).toBe("supply");
      }
    });

    it("should handle all reaction choice fields", () => {
      const choice: PendingChoice = {
        choiceType: "reaction",
        playerId: "test-player",
        triggeringPlayerId: "other-player",
        triggeringCard: "Attack",
        triggerType: "on_attack",
        availableReactions: ["Defense"],
        metadata: {
          allTargets: ["test-player"],
          currentTargetIndex: 0,
          blockedTargets: [],
          originalCause: "test cause",
        },
      };

      if (isReactionChoice(choice)) {
        expect(choice.triggeringPlayerId).toBe("other-player");
        expect(choice.triggerType).toBe("on_attack");
        expect(choice.metadata.originalCause).toBe("test cause");
      }
    });
  });
});
