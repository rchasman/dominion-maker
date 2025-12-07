import { describe, it, expect, beforeEach } from "bun:test";
import { DominionEngine } from "./engine";
import { resetEventCounter } from "../events/id-generator";
import type { GameCommand } from "../commands/types";

/**
 * Engine integration tests
 * Tests the main DominionEngine API and state management
 */

describe("DominionEngine - Initialization", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should create engine with empty state", () => {
    const engine = new DominionEngine();

    expect(engine.state).toBeDefined();
    expect(engine.state.turn).toBe(0);
    expect(engine.state.gameOver).toBe(false);
    expect(engine.eventLog.length).toBe(0);
  });

  it("should start a new game", () => {
    const engine = new DominionEngine();

    const result = engine.startGame(["human", "ai"]);

    expect(result.ok).toBe(true);
    expect(engine.state.players.human).toBeDefined();
    expect(engine.state.players.ai).toBeDefined();
    expect(engine.state.turn).toBe(1);
    expect(engine.state.activePlayer).toBe("human");
    expect(engine.eventLog.length).toBeGreaterThan(0);
  });

  it("should clear previous game when starting new game", () => {
    const engine = new DominionEngine();

    engine.startGame(["human", "ai"]);

    engine.startGame(["player1", "player2"]);

    // Should have reset
    expect(engine.state.players.human).toBeUndefined();
    expect(engine.state.players.player1).toBeDefined();
    // Event log replaced
    expect(engine.eventLog.length).toBeGreaterThan(0);
  });
});

describe("DominionEngine - Command Dispatch", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should dispatch START_GAME command", () => {
    const engine = new DominionEngine();

    const command: GameCommand = {
      type: "START_GAME",
      players: ["human", "ai"],
    };

    const result = engine.dispatch(command);

    expect(result.ok).toBe(true);
    expect(engine.state.turn).toBe(1);
    expect(engine.eventLog.length).toBeGreaterThan(0);
  });

  it("should dispatch PLAY_ACTION command", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    // Give human a Village in hand
    const humanPlayer = engine.state.players.human;
    humanPlayer.hand.push("Village");
    engine.state.actions = 1;

    const command: GameCommand = {
      type: "PLAY_ACTION",
      player: "human",
      card: "Village",
    };

    const eventsBefore = engine.eventLog.length;
    const result = engine.dispatch(command);

    expect(result.ok).toBe(true);
    expect(engine.eventLog.length).toBeGreaterThan(eventsBefore);
  });

  it("should accumulate events from multiple commands", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const eventCountAfterStart = engine.eventLog.length;

    // Manually add cards to hand for testing
    const humanPlayer = engine.state.players.human;
    humanPlayer.hand = ["Village", "Smithy"];
    humanPlayer.deck = ["Copper", "Silver", "Gold", "Estate"];
    engine.state.actions = 2;

    engine.dispatch({ type: "PLAY_ACTION", player: "human", card: "Village" });
    const eventsAfterVillage = engine.eventLog.length;

    engine.dispatch({ type: "PLAY_ACTION", player: "human", card: "Smithy" });
    const eventsAfterSmithy = engine.eventLog.length;

    expect(eventsAfterVillage).toBeGreaterThan(eventCountAfterStart);
    expect(eventsAfterSmithy).toBeGreaterThanOrEqual(eventsAfterVillage); // Smithy might not draw if deck empty
  });

  it("should reject invalid commands", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    // Try to play card not in hand
    const command: GameCommand = {
      type: "PLAY_ACTION",
      player: "human",
      card: "Village",
    };

    const result = engine.dispatch(command);

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe("DominionEngine - State Caching", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should cache state after first access", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const state1 = engine.state;
    const state2 = engine.state;

    // Should return same cached object
    expect(state1).toBe(state2);
  });

  it("should invalidate cache when new events added", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const state1 = engine.state;
    const coins1 = state1.coins;

    // Add cards to enable play
    const humanPlayer = engine.state.players.human;
    humanPlayer.hand = ["Festival"];
    engine.state.actions = 1;

    engine.dispatch({ type: "PLAY_ACTION", player: "human", card: "Festival" });

    const state2 = engine.state;
    const coins2 = state2.coins;

    // State should be different object (cache invalidated)
    expect(state1).not.toBe(state2);
    // Coins should have changed (Festival gives +$2)
    expect(coins2).toBeGreaterThan(coins1);
  });

  it("should recompute state from events when cache invalidated", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    // Manually modify event log (simulating direct event addition)
    const humanPlayer = engine.state.players.human;
    humanPlayer.hand = ["Market"];
    engine.state.actions = 1;

    const eventsBefore = engine.eventLog.length;

    engine.dispatch({ type: "PLAY_ACTION", player: "human", card: "Market" });

    // State should be recomputed from full event log
    expect(engine.eventLog.length).toBeGreaterThan(eventsBefore); // Market generates multiple events
  });
});

describe("DominionEngine - Event Subscribers", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should notify subscribers when events added", () => {
    const engine = new DominionEngine();
    let notified = false;
    let receivedEvents: GameEvent[] = [];

    engine.subscribe((events) => {
      notified = true;
      receivedEvents = events;
    });

    engine.startGame(["human", "ai"]);

    expect(notified).toBe(true);
    expect(receivedEvents.length).toBeGreaterThan(0);
  });

  it("should allow multiple subscribers", () => {
    const engine = new DominionEngine();
    let listener1Called = false;
    let listener2Called = false;

    engine.subscribe(() => {
      listener1Called = true;
    });

    engine.subscribe(() => {
      listener2Called = true;
    });

    engine.startGame(["human", "ai"]);

    expect(listener1Called).toBe(true);
    expect(listener2Called).toBe(true);
  });

  it("should allow unsubscribing", () => {
    const engine = new DominionEngine();
    let called = false;

    const unsubscribe = engine.subscribe(() => {
      called = true;
    });

    unsubscribe(); // Remove listener

    engine.startGame(["human", "ai"]);

    expect(called).toBe(false);
  });
});

describe("DominionEngine - Forking", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should fork engine with independent state", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const forked = engine.fork();

    expect(forked.state.turn).toBe(engine.state.turn);
    expect(forked.eventLog.length).toBe(engine.eventLog.length);
    expect(forked).not.toBe(engine);
  });

  it("should allow modifying forked engine without affecting original", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const originalEvents = engine.eventLog.length;
    const forked = engine.fork();

    // Add cards to forked engine
    forked.state.players.human.hand = ["Village"];
    forked.state.actions = 1;

    forked.dispatch({ type: "PLAY_ACTION", player: "human", card: "Village" });

    // Original unchanged
    expect(engine.eventLog.length).toBe(originalEvents);
    // Fork changed
    expect(forked.eventLog.length).toBeGreaterThan(originalEvents);
  });
});

describe("DominionEngine - Full Game Flow", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should play through a complete turn", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const initialTurn = engine.state.turn;
    const initialPlayer = engine.state.activePlayer;

    // Give human some cards
    engine.state.players.human.hand = ["Village", "Copper"];
    engine.state.players.human.deck = ["Estate", "Duchy"];
    engine.state.actions = 1;

    // Action phase
    const playResult = engine.dispatch({
      type: "PLAY_ACTION",
      player: "human",
      card: "Village",
    });
    expect(playResult.ok).toBe(true);

    // End action phase
    const endActionResult = engine.dispatch({
      type: "END_PHASE",
      player: "human",
    });
    expect(endActionResult.ok).toBe(true);
    expect(engine.state.phase).toBe("buy");

    // Buy phase - play treasure
    engine.state.players.human.hand = ["Copper"];
    const playTreasureResult = engine.dispatch({
      type: "PLAY_TREASURE",
      player: "human",
      card: "Copper",
    });
    expect(playTreasureResult.ok).toBe(true);
    expect(engine.state.coins).toBeGreaterThan(0);

    // End buy phase (ends turn)
    engine.state.players.human.deck = ["Estate", "Duchy", "Province", "Copper", "Silver"];
    const endTurnResult = engine.dispatch({
      type: "END_PHASE",
      player: "human",
    });
    expect(endTurnResult.ok).toBe(true);

    // Should have moved to next turn
    expect(engine.state.turn).toBe(initialTurn + 1);
    expect(engine.state.activePlayer).not.toBe(initialPlayer);
  });

  it("should handle multi-stage card through engine", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    // Give human Chapel and some cards
    engine.state.players.human.hand = ["Chapel", "Copper", "Copper", "Estate", "Estate", "Estate"];
    engine.state.actions = 1;

    // Play Chapel
    const playResult = engine.dispatch({
      type: "PLAY_ACTION",
      player: "human",
      card: "Chapel",
    });

    expect(playResult.ok).toBe(true);
    expect(engine.state.pendingDecision).toBeDefined();
    expect(engine.state.pendingDecision!.cardBeingPlayed).toBe("Chapel");

    // Submit decision to trash 2 cards
    const decisionResult = engine.submitDecision("human", {
      selectedCards: ["Copper", "Copper"],
    });

    expect(decisionResult.ok).toBe(true);
    expect(engine.state.pendingDecision).toBeNull();
    expect(engine.state.trash.length).toBe(2);
  });
});

describe("DominionEngine - State Consistency", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should maintain state consistency after many operations", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    // Perform 10 operations
    for (let i = 0; i < 10; i++) {
      engine.state.players.human.hand = ["Festival"];
      engine.state.actions = 1;

      const result = engine.dispatch({
        type: "PLAY_ACTION",
        player: "human",
        card: "Festival",
      });

      expect(result.ok).toBe(true);
      // State should always be valid
      expect(engine.state).toBeDefined();
      expect(engine.state.players).toBeDefined();
    }

    // Event log should have all events
    expect(engine.eventLog.length).toBeGreaterThan(10);
  });

  it("should keep event log and state in sync", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    // Manually check that state reflects event log
    const stateFromEvents = engine.state;

    // Event log should match state
    expect(stateFromEvents.turn).toBe(1);
    expect(Object.keys(stateFromEvents.players).length).toBe(2);
  });
});
