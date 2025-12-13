import { describe, it, expect } from "bun:test";
import { DominionEngine } from "./engine";
import { buildStrategicContext } from "../agent/strategic-context";

describe("Full mode integration", () => {
  it("should complete a full turn cycle with ai1 and ai2", () => {
    const engine = new DominionEngine();

    // Start game
    const startResult = engine.startGame(["ai1", "ai2"]);
    expect(startResult.ok).toBe(true);

    // Verify ai1 starts
    expect(engine.state.activePlayer).toBe("ai1");
    expect(engine.state.turn).toBe(1);

    // ai1 plays their turn
    const initialPhase = engine.state.phase;
    expect(["action", "buy"]).toContain(initialPhase);

    // End ai1's turn
    if (engine.state.phase === "action") {
      engine.endPhase("ai1");
    }
    if (engine.state.phase === "buy") {
      engine.endPhase("ai1");
    }

    // Should now be ai2's turn
    expect(engine.state.activePlayer).toBe("ai2");
    expect(engine.state.turn).toBe(2);
  });

  it("should allow ai2 to complete their turn", () => {
    const engine = new DominionEngine();

    engine.startGame(["ai1", "ai2"]);

    // Skip ai1's turn
    if (engine.state.phase === "action") engine.endPhase("ai1");
    if (engine.state.phase === "buy") engine.endPhase("ai1");

    expect(engine.state.activePlayer).toBe("ai2");

    // End ai2's turn
    if (engine.state.phase === "action") engine.endPhase("ai2");
    if (engine.state.phase === "buy") engine.endPhase("ai2");

    // Should cycle back to ai1
    expect(engine.state.activePlayer).toBe("ai1");
    expect(engine.state.turn).toBe(3);
  });

  it("should maintain separate player states for ai1 and ai2", () => {
    const engine = new DominionEngine();

    engine.startGame(["ai1", "ai2"]);

    const ai1InitialHand = [...engine.state.players.ai1.hand];
    const ai2InitialHand = [...engine.state.players.ai2.hand];

    // Both should have 5 cards
    expect(ai1InitialHand).toHaveLength(5);
    expect(ai2InitialHand).toHaveLength(5);

    // Verify both players have valid starting cards
    const validStartingCards = ["Copper", "Estate"];
    expect(
      ai1InitialHand.every(card => validStartingCards.includes(card)),
    ).toBe(true);
    expect(
      ai2InitialHand.every(card => validStartingCards.includes(card)),
    ).toBe(true);
  });

  it("should generate valid strategic context for ai1", () => {
    const engine = new DominionEngine();

    engine.startGame(["ai1", "ai2"]);

    // Should not throw
    const context = buildStrategicContext(engine.state);

    expect(context).toContain("yourVictoryPoints:");
    expect(context).toContain("yourDeckTotalCards:");
    expect(context).toContain("opponentDeckTotalCards:");
    expect(context).toContain("yourDeckComposition:");
    expect(context).not.toContain("handCards[");
  });

  it("should generate valid strategic context for ai2", () => {
    const engine = new DominionEngine();

    engine.startGame(["ai1", "ai2"]);

    // Skip to ai2's turn
    if (engine.state.phase === "action") engine.endPhase("ai1");
    if (engine.state.phase === "buy") engine.endPhase("ai1");

    expect(engine.state.activePlayer).toBe("ai2");

    // Should not throw
    const context = buildStrategicContext(engine.state);

    expect(context).toContain("yourVictoryPoints:");
    expect(context).toContain("yourDeckTotalCards:");
    expect(context).toContain("opponentDeckTotalCards:");
    expect(context).toContain("yourDeckComposition:");
    expect(context).not.toContain("handCards[");
  });

  it("should allow both AIs to buy cards", () => {
    const engine = new DominionEngine();

    engine.startGame(["ai1", "ai2"]);

    // ai1's turn - skip to buy phase
    if (engine.state.phase === "action") engine.endPhase("ai1");

    // Play all treasures for ai1
    const ai1Hand = [...engine.state.players.ai1.hand];
    ai1Hand.forEach(card => {
      if (card === "Copper" || card === "Silver" || card === "Gold") {
        engine.playTreasure("ai1", card);
      }
    });

    const initialCoins = engine.state.coins;
    expect(initialCoins).toBeGreaterThan(0);

    // Try to buy a card
    if (engine.state.coins >= 2) {
      const result = engine.buyCard("ai1", "Estate");
      expect(result.ok).toBe(true);
    }

    // End ai1's turn
    engine.endPhase("ai1");

    // ai2's turn
    expect(engine.state.activePlayer).toBe("ai2");
  });

  it("should track VP correctly for both AI players", () => {
    const engine = new DominionEngine();

    engine.startGame(["ai1", "ai2"]);

    const countVP = (playerId: string) => {
      const player = engine.state.players[playerId];
      const allCards = [
        ...player.deck,
        ...player.hand,
        ...player.discard,
        ...player.inPlay,
      ];
      return allCards.filter(c => c === "Estate").length;
    };

    // Both should start with 3 Estates = 3 VP each
    expect(countVP("ai1")).toBe(3);
    expect(countVP("ai2")).toBe(3);
  });

  it("should handle game over condition with ai1 and ai2", () => {
    const engine = new DominionEngine();

    engine.startGame(["ai1", "ai2"]);

    // Empty the Province pile to trigger game end
    engine.state.supply.Province = 0;

    // End ai1's turn (should trigger game over check)
    if (engine.state.phase === "action") engine.endPhase("ai1");
    if (engine.state.phase === "buy") engine.endPhase("ai1");

    // Game should be over
    expect(engine.state.gameOver).toBe(true);
    expect(["ai1", "ai2"]).toContain(engine.state.winner);
  });

  it("should not allow human or ai players to act in full mode", () => {
    const engine = new DominionEngine();

    engine.startGame(["ai1", "ai2"]);

    // These should fail because these players don't exist
    const result1 = engine.endPhase("human");
    const result2 = engine.endPhase("ai");

    expect(result1.ok).toBe(false);
    expect(result2.ok).toBe(false);
  });

  it("should alternate between ai1 and ai2 for multiple turns", () => {
    const engine = new DominionEngine();

    engine.startGame(["ai1", "ai2"]);

    // Record 10 turns
    const turnSequence = Array.from({ length: 10 }).reduce<string[]>(acc => {
      if (engine.state.gameOver) return acc;

      acc.push(engine.state.activePlayer);

      if (engine.state.phase === "action") {
        engine.endPhase(engine.state.activePlayer);
      }
      if (engine.state.phase === "buy") {
        engine.endPhase(engine.state.activePlayer);
      }

      return acc;
    }, []);

    // Should alternate: ai1, ai2, ai1, ai2, ...
    expect(turnSequence[0]).toBe("ai1");
    expect(turnSequence[1]).toBe("ai2");
    expect(turnSequence[2]).toBe("ai1");
    expect(turnSequence[3]).toBe("ai2");

    // No human or ai should appear
    expect(turnSequence).not.toContain("human");
    expect(turnSequence).not.toContain("ai");
  });
});
