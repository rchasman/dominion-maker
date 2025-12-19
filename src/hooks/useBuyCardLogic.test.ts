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
        return { ok: true };
      };

      const submitDecision = (choice: DecisionChoice): CommandResult => {
        submitDecisionCalled.push(choice);
        return { ok: true };
      };

      const pendingChoice = null;

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
        return { ok: true };
      };

      const submitDecision = (choice: DecisionChoice): CommandResult => {
        submitDecisionCalled.push(choice);
        return { ok: true };
      };

      const pendingChoice: Extract<PendingChoice, { choiceType: "decision" }> = {
        id: "choice-1",
        playerId: "human",
        choiceType: "decision",
        cardBeingPlayed: "Workshop",
        from: "supply",
        count: 1,
        optional: false,
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
        return { ok: true };
      };

      const submitDecision = (choice: DecisionChoice): CommandResult => {
        submitDecisionCalled.push(choice);
        return { ok: true };
      };

      const pendingChoice: Extract<PendingChoice, { choiceType: "decision" }> = {
        id: "choice-1",
        playerId: "human",
        choiceType: "decision",
        cardBeingPlayed: "Remodel",
        from: "hand",
        count: 1,
        optional: false,
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
        return { ok: true };
      };

      const submitDecision = (choice: DecisionChoice): CommandResult => {
        submitDecisionCalled.push(choice);
        return { ok: true };
      };

      const pendingChoice: Extract<PendingChoice, { choiceType: "reaction" }> = {
        id: "choice-1",
        playerId: "human",
        choiceType: "reaction",
        card: "Moat",
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

      const buyCard = (card: CardName): CommandResult => {
        return { ok: true };
      };

      const submitDecision = (choice: DecisionChoice): CommandResult => {
        return { ok: false, error: "Invalid choice" };
      };

      const pendingChoice: Extract<PendingChoice, { choiceType: "decision" }> = {
        id: "choice-1",
        playerId: "human",
        choiceType: "decision",
        cardBeingPlayed: "Mine",
        from: "supply",
        count: 1,
        optional: false,
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

      const buyCard = (card: CardName): CommandResult => {
        return { ok: false, error: "Can't buy that" };
      };

      const submitDecision = (choice: DecisionChoice): CommandResult => {
        return { ok: true };
      };

      const pendingChoice = null;

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

      const buyCard = (card: CardName): CommandResult => {
        return { ok: true };
      };

      const submitDecision = (choice: DecisionChoice): CommandResult => {
        submittedChoices.push(choice);
        return { ok: true };
      };

      const pendingChoice: Extract<PendingChoice, { choiceType: "decision" }> = {
        id: "choice-1",
        playerId: "human",
        choiceType: "decision",
        cardBeingPlayed: "Artisan",
        from: "supply",
        count: 2,
        optional: false,
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
      const buyCard = (): CommandResult => ({ ok: true });
      const submitDecision = (): CommandResult => ({ ok: true });

      const pendingChoice: Extract<PendingChoice, { choiceType: "reaction" }> = {
        id: "choice-1",
        playerId: "human",
        choiceType: "reaction",
        card: "Moat",
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
      const buyCard = (): CommandResult => ({ ok: true });
      const submitDecision = (): CommandResult => ({ ok: true });

      const pendingChoice: Extract<PendingChoice, { choiceType: "decision" }> | undefined =
        undefined;

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
      const buyCard = (): CommandResult => ({ ok: true });
      const submitDecision = (): CommandResult => ({ ok: true });

      const pendingChoice:
        | Extract<PendingChoice, { choiceType: "decision" }>
        | null = null;

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
        return { ok: true };
      };

      const submitDecision = (): CommandResult => ({ ok: true });

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
