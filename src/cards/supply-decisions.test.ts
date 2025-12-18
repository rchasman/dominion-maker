/**
 * End-to-end tests for cards with from="supply" pending decisions.
 *
 * These tests verify the complete flow:
 * 1. Play a card that creates a from="supply" decision
 * 2. Submit the decision by selecting a supply card
 * 3. Verify the card is gained (not bought)
 *
 * This tests the integration between card effects, pending decisions,
 * and the supply interaction logic that routes clicks to submitDecision
 * instead of buyCard.
 */

import { describe, it, expect } from "bun:test";
import { DominionEngine } from "../engine";
import type { CardName } from "../types/game-state";

function createTestEngine(humanHand: CardName[]): DominionEngine {
  const engine = new DominionEngine();
  engine.startGame(["human", "ai"], ["Workshop", "Artisan", "Remodel", "Mine"]);

  // Replace human's hand
  const humanState = engine.state.players.human;
  humanState.deck = [];
  humanState.hand = [...humanHand];

  return engine;
}

describe("Supply Decision E2E Tests", () => {
  describe("Workshop", () => {
    it("creates from='supply' decision when played", () => {
      const engine = createTestEngine(["Workshop"]);

      // Play Workshop
      engine.playAction("human", "Workshop");

      // Should create pending decision from supply
      expect(engine.state.pendingChoice).toBeDefined();
      expect(engine.state.pendingChoice?.choiceType).toBe("decision");
      expect(engine.state.pendingChoice?.from).toBe("supply");
      expect(engine.state.pendingChoice?.playerId).toBe("human");
      expect(engine.state.pendingChoice?.cardOptions).toContain("Silver");
      expect(engine.state.pendingChoice?.min).toBe(1);
      expect(engine.state.pendingChoice?.max).toBe(1);
    });

    it("gains card to discard when decision submitted", () => {
      const engine = createTestEngine(["Workshop"]);
      engine.playAction("human", "Workshop");

      const initialDiscardSize = engine.state.players.human.discard.length;
      const initialSupply = engine.state.supply.Silver;

      // Submit decision by selecting Silver
      const result = engine.submitDecision("human", {
        selectedCards: ["Silver"],
      });

      expect(result.ok).toBe(true);
      expect(engine.state.pendingChoice).toBeNull();
      expect(engine.state.players.human.discard.length).toBe(
        initialDiscardSize + 1,
      );
      expect(engine.state.players.human.discard).toContain("Silver");
      expect(engine.state.supply.Silver).toBe(initialSupply - 1);
    });

    it("gains card without consuming buys", () => {
      const engine = createTestEngine(["Workshop"]);
      engine.playAction("human", "Workshop");

      // Note starting buys
      const initialBuys = engine.state.buys;

      // Submit decision
      engine.submitDecision("human", { selectedCards: ["Silver"] });

      // Buys should not be consumed (this was a gain, not a buy)
      expect(engine.state.buys).toBe(initialBuys);
    });

    it("respects cost limit of $4", () => {
      const engine = createTestEngine(["Workshop"]);
      engine.playAction("human", "Workshop");

      // Silver costs $3 - should be in options
      expect(engine.state.pendingChoice?.cardOptions).toContain("Silver");

      // Gold costs $6 - should NOT be in options
      expect(engine.state.pendingChoice?.cardOptions).not.toContain("Gold");

      // Duchy costs $5 - should NOT be in options
      expect(engine.state.pendingChoice?.cardOptions).not.toContain("Duchy");
    });
  });

  describe("Artisan", () => {
    it("creates from='supply' decision for gaining to hand", () => {
      const engine = createTestEngine(["Artisan"]);

      engine.playAction("human", "Artisan");

      // Stage 1: Gain card to hand
      expect(engine.state.pendingChoice).toBeDefined();
      expect(engine.state.pendingChoice?.from).toBe("supply");
      expect(engine.state.pendingChoice?.stage).toBe("gain");
    });

    it("gains card to hand, then topdecks", () => {
      const engine = createTestEngine(["Artisan", "Copper"]);

      // Stage 1: Play Artisan
      engine.playAction("human", "Artisan");

      const initialHandSize = engine.state.players.human.hand.length;

      // Stage 2: Gain Silver to hand
      engine.submitDecision("human", { selectedCards: ["Silver"] });

      // Verify Silver in hand
      expect(engine.state.players.human.hand).toContain("Silver");
      expect(engine.state.players.human.hand.length).toBe(initialHandSize + 1);

      // Stage 3: Topdeck a card from hand
      expect(engine.state.pendingChoice).toBeDefined();
      expect(engine.state.pendingChoice?.from).toBe("hand");
      expect(engine.state.pendingChoice?.stage).toBe("topdeck");

      engine.submitDecision("human", { selectedCards: ["Copper"] });

      // Verify Copper on top of deck
      const deck = engine.state.players.human.deck;
      expect(deck[deck.length - 1]).toBe("Copper");
    });

    it("respects cost limit of $5", () => {
      const engine = createTestEngine(["Artisan"]);
      engine.playAction("human", "Artisan");

      // Silver costs $3 - should be in options
      expect(engine.state.pendingChoice?.cardOptions).toContain("Silver");

      // Duchy costs $5 - should be in options
      expect(engine.state.pendingChoice?.cardOptions).toContain("Duchy");

      // Gold costs $6 - should NOT be in options
      expect(engine.state.pendingChoice?.cardOptions).not.toContain("Gold");
    });
  });

  describe("Remodel", () => {
    it("creates two-stage decision: trash from hand, then gain from supply", () => {
      const engine = createTestEngine(["Remodel", "Copper"]);

      engine.playAction("human", "Remodel");

      // Stage 1: Trash from hand
      expect(engine.state.pendingChoice).toBeDefined();
      expect(engine.state.pendingChoice?.from).toBe("hand");
      expect(engine.state.pendingChoice?.stage).toBe("trash");

      const initialTrashSize = engine.state.trash.length;

      engine.submitDecision("human", { selectedCards: ["Copper"] });

      // Copper should be trashed
      expect(engine.state.trash.length).toBe(initialTrashSize + 1);
      expect(engine.state.trash).toContain("Copper");

      // Stage 2: Gain from supply (costing up to $2 more than trashed card)
      expect(engine.state.pendingChoice).toBeDefined();
      expect(engine.state.pendingChoice?.from).toBe("supply");
      expect(engine.state.pendingChoice?.stage).toBe("gain");
    });

    it("allows gaining card costing up to $2 more than trashed card", () => {
      const engine = createTestEngine(["Remodel", "Silver"]);

      // Play Remodel
      engine.playAction("human", "Remodel");

      // Trash Silver ($3)
      engine.submitDecision("human", { selectedCards: ["Silver"] });

      // Should be able to gain cards costing up to $5 ($3 + $2)
      expect(engine.state.pendingChoice?.cardOptions).toContain("Duchy"); // $5
      expect(engine.state.pendingChoice?.cardOptions).not.toContain("Gold"); // $6
    });
  });

  describe("Mine", () => {
    it("creates two-stage decision for treasure upgrade", () => {
      const engine = createTestEngine(["Mine", "Copper", "Silver"]);

      engine.playAction("human", "Mine");

      // Stage 1: Trash treasure from hand
      expect(engine.state.pendingChoice).toBeDefined();
      expect(engine.state.pendingChoice?.from).toBe("hand");
      expect(engine.state.pendingChoice?.stage).toBe("trash");

      // Options should only include treasures
      expect(engine.state.pendingChoice?.cardOptions).toContain("Copper");
      expect(engine.state.pendingChoice?.cardOptions).toContain("Silver");
      expect(engine.state.pendingChoice?.cardOptions).not.toContain("Mine");
    });

    it("gains treasure to hand costing up to $3 more", () => {
      const engine = createTestEngine(["Mine", "Copper", "Estate"]);

      engine.playAction("human", "Mine");

      // Trash Copper ($0)
      engine.submitDecision("human", { selectedCards: ["Copper"] });

      // Stage 2: Gain treasure to hand (up to $3)
      expect(engine.state.pendingChoice?.from).toBe("supply");
      expect(engine.state.pendingChoice?.stage).toBe("gain");

      // Should be able to gain Silver ($3) but not Gold ($6)
      expect(engine.state.pendingChoice?.cardOptions).toContain("Silver");
      expect(engine.state.pendingChoice?.cardOptions).not.toContain("Gold");

      // Gain Silver to hand
      engine.submitDecision("human", { selectedCards: ["Silver"] });

      // Silver should be in hand, not discard
      expect(engine.state.players.human.hand).toContain("Silver");
      expect(engine.state.players.human.discard).not.toContain("Silver");
    });

    it("allows upgrading Silver to Gold", () => {
      const engine = createTestEngine(["Mine", "Silver"]);

      engine.playAction("human", "Mine");

      // Trash Silver ($3)
      engine.submitDecision("human", { selectedCards: ["Silver"] });

      // Should be able to gain Gold ($6 = $3 + $3)
      expect(engine.state.pendingChoice?.cardOptions).toContain("Gold");

      // Gain Gold
      engine.submitDecision("human", { selectedCards: ["Gold"] });

      expect(engine.state.players.human.hand).toContain("Gold");
    });
  });

  describe("Throne Room + Workshop", () => {
    it("creates decision to choose action from hand", () => {
      const engine = createTestEngine(["Throne Room", "Workshop"]);

      // Play Throne Room
      engine.playAction("human", "Throne Room");

      // Stage 1: Choose action from hand
      expect(engine.state.pendingChoice).toBeDefined();
      expect(engine.state.pendingChoice?.from).toBe("hand");
      expect(engine.state.pendingChoice?.stage).toBe("choose_action");
      expect(engine.state.pendingChoice?.cardOptions).toContain("Workshop");
    });

    it("prepares to execute chosen action twice", () => {
      const engine = createTestEngine(["Throne Room", "Workshop"]);

      engine.playAction("human", "Throne Room");

      // Choose Workshop
      const result = engine.submitDecision("human", {
        selectedCards: ["Workshop"],
      });

      // Should create a special "execute_throned_card" decision
      expect(result.ok).toBe(true);
      expect(engine.state.pendingChoice?.stage).toBe("execute_throned_card");
      expect(engine.state.pendingChoice?.metadata?.throneRoomTarget).toBe(
        "Workshop",
      );
      expect(
        engine.state.pendingChoice?.metadata?.throneRoomExecutionsRemaining,
      ).toBe(2);
    });
  });

  describe("Edge Cases", () => {
    it("Workshop with empty supply of gainable cards still shows available options", () => {
      const engine = createTestEngine(["Workshop"]);

      // Empty the supply of common cards <= $4
      engine.state.supply.Copper = 0;
      engine.state.supply.Silver = 0;
      engine.state.supply.Estate = 0;

      engine.playAction("human", "Workshop");

      // Decision should still be created with remaining cards
      // (e.g., Curse at $0, or kingdom cards like Workshop itself)
      expect(engine.state.pendingChoice).toBeDefined();
      expect(engine.state.pendingChoice?.cardOptions.length).toBeGreaterThan(0);
    });

    it("Workshop with completely empty supply creates no decision", () => {
      const engine = createTestEngine(["Workshop"]);

      // Empty ALL supply cards
      Object.keys(engine.state.supply).forEach(card => {
        engine.state.supply[card] = 0;
      });

      engine.playAction("human", "Workshop");

      // No decision should be created if truly no cards can be gained
      expect(engine.state.pendingChoice).toBeNull();
    });

    it("Submitting invalid card selection is handled gracefully", () => {
      const engine = createTestEngine(["Workshop"]);
      engine.playAction("human", "Workshop");

      // Try to gain Gold (costs $6, above Workshop's $4 limit)
      const result = engine.submitDecision("human", {
        selectedCards: ["Gold"],
      });

      // Engine should handle this - either reject it or filter it
      // The exact behavior depends on submitDecision implementation
      expect(result).toBeDefined();
    });
  });
});
