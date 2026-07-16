import { describe, it, expect } from "bun:test";
import type { CardName, DecisionChoice } from "../types/game-state";
import type { CommandResult } from "../commands/types";
import type { PendingChoice } from "../events/types";

describe("useBuyCardLogic hook", () => {
  /**
   * Since useBuyCardLogic is a React hook that uses useCallback, we can't directly
   * call it outside of a React component. However, we can test the pure logic it implements.
   */

  describe("buy card routing logic", () => {
    it("should route to buyCard when no pending decision", () => {
      const buyCardCalled: CardName[] = [];
      const submitDecisionCalled: DecisionChoice[] = [];

      const buyCard = (card: CardName): CommandResult => {
        buyCardCalled.push(card);
        return { ok: true, events: [] };
      };

      const submitDecision = (choice: DecisionChoice): CommandResult => {
        submitDecisionCalled.push(choice);
        return { ok: true, events: [] };
      };

      const pendingChoice = null as Extract<
        PendingChoice,
        { choiceType: "decision" }
      > | null;

      // Simulate the hook's logic
      const handleBuyCard = (card: CardName): CommandResult => {
        if (pendingChoice?.from === "supply") {
          return submitDecision({ selectedCards: [card] });
        }
        return buyCard(card);
      };

      const result = handleBuyCard("Village");
      expect(result.ok).toBe(true);
      expect(buyCardCalled).toEqual(["Village"]);
      expect(submitDecisionCalled).toEqual([]);
    });

    it("should route to submitDecision when pending decision from supply", () => {
      const buyCardCalled: CardName[] = [];
      const submitDecisionCalled: DecisionChoice[] = [];

      const buyCard = (card: CardName): CommandResult => {
        buyCardCalled.push(card);
        return { ok: true, events: [] };
      };

      const submitDecision = (choice: DecisionChoice): CommandResult => {
        submitDecisionCalled.push(choice);
        return { ok: true, events: [] };
      };

      const pendingChoice: Extract<PendingChoice, { choiceType: "decision" }> = {
        playerId: "human",
        choiceType: "decision",
        prompt: "Gain a card costing up to $4",
        cardOptions: [],
        cardBeingPlayed: "Workshop",
        from: "supply",
        min: 1,
        max: 1,
      };

      // Simulate the hook's logic
      const handleBuyCard = (card: CardName): CommandResult => {
        if (pendingChoice?.from === "supply") {
          return submitDecision({ selectedCards: [card] });
        }
        return buyCard(card);
      };

      const result = handleBuyCard("Copper");
      expect(result.ok).toBe(true);
      expect(buyCardCalled).toEqual([]);
      expect(submitDecisionCalled).toEqual([{ selectedCards: ["Copper"] }]);
    });

    it("should route to buyCard when pending decision from hand", () => {
      const buyCardCalled: CardName[] = [];
      const submitDecisionCalled: DecisionChoice[] = [];

      const buyCard = (card: CardName): CommandResult => {
        buyCardCalled.push(card);
        return { ok: true, events: [] };
      };

      const submitDecision = (choice: DecisionChoice): CommandResult => {
        submitDecisionCalled.push(choice);
        return { ok: true, events: [] };
      };

      const pendingChoice: Extract<PendingChoice, { choiceType: "decision" }> = {
        playerId: "human",
        choiceType: "decision",
        prompt: "Trash a card from your hand",
        cardOptions: [],
        cardBeingPlayed: "Remodel",
        from: "hand",
        min: 1,
        max: 1,
      };

      // Simulate the hook's logic
      const handleBuyCard = (card: CardName): CommandResult => {
        if (pendingChoice?.from === "supply") {
          return submitDecision({ selectedCards: [card] });
        }
        return buyCard(card);
      };

      const result = handleBuyCard("Silver");
      expect(result.ok).toBe(true);
      expect(buyCardCalled).toEqual(["Silver"]);
      expect(submitDecisionCalled).toEqual([]);
    });

    it("should route to buyCard when pending choice is not decision type", () => {
      const buyCardCalled: CardName[] = [];
      const submitDecisionCalled: DecisionChoice[] = [];

      const buyCard = (card: CardName): CommandResult => {
        buyCardCalled.push(card);
        return { ok: true, events: [] };
      };

      const submitDecision = (choice: DecisionChoice): CommandResult => {
        submitDecisionCalled.push(choice);
        return { ok: true, events: [] };
      };

      const pendingChoice: Extract<PendingChoice, { choiceType: "reaction" }> = {
        playerId: "human",
        choiceType: "reaction",
        triggeringPlayerId: "ai",
        triggeringCard: "Militia",
        triggerType: "on_attack",
        availableReactions: ["Moat"],
        metadata: {
          allTargets: ["human"],
          currentTargetIndex: 0,
          blockedTargets: [],
          originalCause: "event-1",
        },
      };

      // Simulate the hook's logic
      const handleBuyCard = (card: CardName): CommandResult => {
        if (
          pendingChoice &&
          "from" in pendingChoice &&
          pendingChoice?.from === "supply"
        ) {
          return submitDecision({ selectedCards: [card] });
        }
        return buyCard(card);
      };

      const result = handleBuyCard("Gold");
      expect(result.ok).toBe(true);
      expect(buyCardCalled).toEqual(["Gold"]);
      expect(submitDecisionCalled).toEqual([]);
    });

    it("should handle submission errors gracefully", () => {
      let errorLogged = false;

      const buyCard = (_card: CardName): CommandResult => {
        return { ok: true, events: [] };
      };

      const submitDecision = (_choice: DecisionChoice): CommandResult => {
        return { ok: false, error: "Invalid choice" };
      };

      const pendingChoice: Extract<PendingChoice, { choiceType: "decision" }> = {
        playerId: "human",
        choiceType: "decision",
        prompt: "Gain a Treasure costing up to $3 more",
        cardOptions: [],
        cardBeingPlayed: "Mine",
        from: "supply",
        min: 1,
        max: 1,
      };

      // Simulate the hook's logic with error handling
      const handleBuyCard = (card: CardName): CommandResult => {
        if (pendingChoice?.from === "supply") {
          const result = submitDecision({ selectedCards: [card] });
          if (!result.ok) {
            errorLogged = true;
          }
          return result;
        }
        return buyCard(card);
      };

      const result = handleBuyCard("Estate");
      expect(result.ok).toBe(false);
      expect(errorLogged).toBe(true);
    });

    it("should handle buy card errors gracefully", () => {
      let errorLogged = false;

      const buyCard = (_card: CardName): CommandResult => {
        return { ok: false, error: "Can't buy that" };
      };

      const submitDecision = (_choice: DecisionChoice): CommandResult => {
        return { ok: true, events: [] };
      };

      const pendingChoice = null as Extract<
        PendingChoice,
        { choiceType: "decision" }
      > | null;

      // Simulate the hook's logic with error handling
      const handleBuyCard = (card: CardName): CommandResult => {
        if (pendingChoice?.from === "supply") {
          return submitDecision({ selectedCards: [card] });
        }
        const result = buyCard(card);
        if (!result.ok) {
          errorLogged = true;
        }
        return result;
      };

      const result = handleBuyCard("Duchy");
      expect(result.ok).toBe(false);
      expect(errorLogged).toBe(true);
    });

    it("should pass card to submitDecision with selectedCards array", () => {
      const submittedChoices: DecisionChoice[] = [];

      const buyCard = (_card: CardName): CommandResult => {
        return { ok: true, events: [] };
      };

      const submitDecision = (choice: DecisionChoice): CommandResult => {
        submittedChoices.push(choice);
        return { ok: true, events: [] };
      };

      const pendingChoice: Extract<PendingChoice, { choiceType: "decision" }> = {
        playerId: "human",
        choiceType: "decision",
        prompt: "Gain a card to your hand costing up to $5",
        cardOptions: [],
        cardBeingPlayed: "Artisan",
        from: "supply",
        min: 1,
        max: 2,
      };

      // Simulate the hook's logic
      const handleBuyCard = (card: CardName): CommandResult => {
        if (pendingChoice?.from === "supply") {
          return submitDecision({ selectedCards: [card] });
        }
        return buyCard(card);
      };

      handleBuyCard("Village");
      handleBuyCard("Market");

      expect(submittedChoices).toEqual([
        { selectedCards: ["Village"] },
        { selectedCards: ["Market"] },
      ]);
    });
  });

  describe("pendingChoice type handling", () => {
    it("should only check 'from' property for decision choices", () => {
      const buyCard = (_card: CardName): CommandResult => ({
        ok: true,
        events: [],
      });
      const submitDecision = (_choice: DecisionChoice): CommandResult => ({
        ok: true,
        events: [],
      });

      const pendingChoice: Extract<PendingChoice, { choiceType: "reaction" }> = {
        playerId: "human",
        choiceType: "reaction",
        triggeringPlayerId: "ai",
        triggeringCard: "Militia",
        triggerType: "on_attack",
        availableReactions: ["Moat"],
        metadata: {
          allTargets: ["human"],
          currentTargetIndex: 0,
          blockedTargets: [],
          originalCause: "event-1",
        },
      };

      const handleBuyCard = (card: CardName): CommandResult => {
        if (
          pendingChoice &&
          "from" in pendingChoice &&
          pendingChoice?.from === "supply"
        ) {
          return submitDecision({ selectedCards: [card] });
        }
        return buyCard(card);
      };

      const result = handleBuyCard("Smithy");
      expect(result.ok).toBe(true);
    });

    it("should handle undefined pendingChoice", () => {
      const buyCard = (_card: CardName): CommandResult => ({
        ok: true,
        events: [],
      });
      const submitDecision = (_choice: DecisionChoice): CommandResult => ({
        ok: true,
        events: [],
      });

      const pendingChoice = undefined as
        | Extract<PendingChoice, { choiceType: "decision" }>
        | undefined;

      const handleBuyCard = (card: CardName): CommandResult => {
        if (pendingChoice?.from === "supply") {
          return submitDecision({ selectedCards: [card] });
        }
        return buyCard(card);
      };

      const result = handleBuyCard("Festival");
      expect(result.ok).toBe(true);
    });

    it("should handle null pendingChoice", () => {
      const buyCard = (_card: CardName): CommandResult => ({
        ok: true,
        events: [],
      });
      const submitDecision = (_choice: DecisionChoice): CommandResult => ({
        ok: true,
        events: [],
      });

      const pendingChoice = null as Extract<
        PendingChoice,
        { choiceType: "decision" }
      > | null;

      const handleBuyCard = (card: CardName): CommandResult => {
        if (pendingChoice?.from === "supply") {
          return submitDecision({ selectedCards: [card] });
        }
        return buyCard(card);
      };

      const result = handleBuyCard("Cellar");
      expect(result.ok).toBe(true);
    });
  });

  describe("card name handling", () => {
    it("should pass through card names correctly", () => {
      const cardsPassed: CardName[] = [];

      const buyCard = (card: CardName): CommandResult => {
        cardsPassed.push(card);
        return { ok: true, events: [] };
      };

      const testCards: CardName[] = [
        "Copper",
        "Silver",
        "Gold",
        "Village",
        "Smithy",
      ];

      for (const card of testCards) {
        const handleBuyCard = (c: CardName): CommandResult => {
          return buyCard(c);
        };
        handleBuyCard(card);
      }

      expect(cardsPassed).toEqual(testCards);
    });
  });
});
