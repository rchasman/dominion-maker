import { describe, it, expect, beforeEach } from "bun:test";
import { DominionEngine } from "./engine";
import { resetEventCounter } from "../events/id-generator";

/**
 * Integration tests for full game scenarios
 * Tests shuffle mechanics, multi-turn scenarios, and game end conditions
 */

describe("Shuffle Mechanics", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should shuffle discard into deck when drawing with empty deck", () => {
    const engine = new DominionEngine();
    engine.startGame(["human"]);

    // Setup: empty deck, cards in discard
    engine.state.players.human!.deck = [];
    engine.state.players.human!.discard = ["Copper", "Silver", "Gold"];
    engine.state.players.human!.hand = ["Smithy"];
    engine.state.actions = 1;

    // Play Smithy (draws 3)
    engine.dispatch({ type: "PLAY_ACTION", playerId: "human", card: "Smithy" });

    // Should have shuffled
    const shuffleEvent = engine.eventLog.find((e: GameEvent) => e.type === "DECK_SHUFFLED");
    expect(shuffleEvent).toBeDefined();

    // Should have drawn cards
    const drawEvents = engine.eventLog.filter(
      e => e.type === "CARD_DRAWN" && e.playerId === "human",
    );
    expect(drawEvents.length).toBe(3);

    // Discard should be empty (shuffled into deck)
    expect(engine.state.players.human!.discard.length).toBe(0);
  });

  it("should generate DECK_SHUFFLED event with newDeckOrder", () => {
    const engine = new DominionEngine();
    engine.startGame(["human"]);

    engine.state.players.human!.deck = [];
    engine.state.players.human!.discard = ["Copper", "Silver", "Gold"];
    engine.state.players.human!.hand = ["Smithy"];
    engine.state.actions = 1;

    engine.dispatch({ type: "PLAY_ACTION", playerId: "human", card: "Smithy" });

    const shuffleEvent = engine.eventLog.find((e: GameEvent) => e.type === "DECK_SHUFFLED");
    expect(shuffleEvent).toBeDefined();
    if (shuffleEvent) {
      expect(shuffleEvent.newDeckOrder).toBeDefined();
      if (shuffleEvent.newDeckOrder) {
        expect(shuffleEvent.newDeckOrder.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("Multi-Turn Scenarios", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should cycle through multiple turns", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    expect(engine.state.turn).toBe(1);
    expect(engine.state.activePlayerId).toBe("human");

    // End human's turn
    engine.state.players.human!.deck = [
      "Copper",
      "Silver",
      "Gold",
      "Estate",
      "Duchy",
    ];
    engine.dispatch({ type: "END_PHASE", playerId: "human" });
    engine.dispatch({ type: "END_PHASE", playerId: "human" });

    expect(engine.state.turn).toBe(2);
    expect(engine.state.activePlayerId).toBe("ai");

    // End ai's turn
    engine.state.players.ai!.deck = [
      "Copper",
      "Copper",
      "Copper",
      "Estate",
      "Estate",
    ];
    engine.dispatch({ type: "END_PHASE", playerId: "ai" });
    engine.dispatch({ type: "END_PHASE", playerId: "ai" });

    expect(engine.state.turn).toBe(3);
    expect(engine.state.activePlayerId).toBe("human");
  });

  it("should reset resources each turn", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    // Play Festival for +2 actions, +1 buy, +$2
    engine.state.players.human!.hand = ["Festival"];
    engine.state.actions = 1;

    engine.dispatch({
      type: "PLAY_ACTION",
      playerId: "human",
      card: "Festival",
    });

    const actionsAfterFestival = engine.state.actions;
    const buysAfterFestival = engine.state.buys;
    const coinsAfterFestival = engine.state.coins;

    expect(actionsAfterFestival).toBeGreaterThan(1);
    expect(buysAfterFestival).toBeGreaterThan(1);
    expect(coinsAfterFestival).toBeGreaterThan(0);

    // End turn
    engine.state.players.human!.deck = [
      "Copper",
      "Silver",
      "Gold",
      "Estate",
      "Duchy",
    ];
    engine.dispatch({ type: "END_PHASE", playerId: "human" });
    engine.dispatch({ type: "END_PHASE", playerId: "human" });

    // AI's turn should have fresh resources
    expect(engine.state.actions).toBe(1);
    expect(engine.state.buys).toBe(1);
    expect(engine.state.coins).toBe(0);
  });

  it("should handle 3-player turn rotation", () => {
    const engine = new DominionEngine();
    engine.startGame(["player1", "player2", "player3"]);

    expect(engine.state.activePlayerId).toBe("player1");

    // End player1's turn
    engine.state.players.player1!.deck = [
      "Copper",
      "Copper",
      "Copper",
      "Estate",
      "Estate",
    ];
    engine.dispatch({ type: "END_PHASE", playerId: "player1" });
    engine.dispatch({ type: "END_PHASE", playerId: "player1" });

    expect(engine.state.activePlayerId).toBe("player2");

    // End player2's turn
    engine.state.players.player2!.deck = [
      "Copper",
      "Copper",
      "Copper",
      "Estate",
      "Estate",
    ];
    engine.dispatch({ type: "END_PHASE", playerId: "player2" });
    engine.dispatch({ type: "END_PHASE", playerId: "player2" });

    expect(engine.state.activePlayerId).toBe("player3");

    // End player3's turn - should cycle back
    engine.state.players.player3!.deck = [
      "Copper",
      "Copper",
      "Copper",
      "Estate",
      "Estate",
    ];
    engine.dispatch({ type: "END_PHASE", playerId: "player3" });
    engine.dispatch({ type: "END_PHASE", playerId: "player3" });

    expect(engine.state.activePlayerId).toBe("player1");
  });
});
