import { describe, it, expect, beforeEach } from "bun:test";
import { DominionEngine, createGame } from "./engine";
import { resetEventCounter } from "../events/id-generator";
import type { GameCommand } from "../commands/types";
import type { GameEvent } from "../events/types";

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
    expect(engine.state.players.human!).toBeDefined();
    expect(engine.state.players.ai).toBeDefined();
    expect(engine.state.turn).toBe(1);
    expect(engine.state.activePlayerId).toBe("human");
    expect(engine.eventLog.length).toBeGreaterThan(0);
  });

  it("should clear previous game when starting new game", () => {
    const engine = new DominionEngine();

    engine.startGame(["human", "ai"]);

    engine.startGame(["player1", "player2"]);

    // Should have reset
    expect(engine.state.players.human!).toBeUndefined();
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
    const humanPlayer = engine.state.players.human!;
    humanPlayer.hand.push("Village");
    engine.state.actions = 1;

    const command: GameCommand = {
      type: "PLAY_ACTION",
      playerId: "human",
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
    const humanPlayer = engine.state.players.human!;
    humanPlayer.hand = ["Village", "Smithy"];
    humanPlayer.deck = ["Copper", "Silver", "Gold", "Estate"];
    engine.state.actions = 2;

    engine.dispatch({
      type: "PLAY_ACTION",
      playerId: "human",
      card: "Village",
    });
    const eventsAfterVillage = engine.eventLog.length;

    engine.dispatch({ type: "PLAY_ACTION", playerId: "human", card: "Smithy" });
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
      playerId: "human",
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
    const humanPlayer = engine.state.players.human!;
    humanPlayer.hand = ["Festival"];
    engine.state.actions = 1;

    engine.dispatch({
      type: "PLAY_ACTION",
      playerId: "human",
      card: "Festival",
    });

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
    const humanPlayer = engine.state.players.human!;
    humanPlayer.hand = ["Market"];
    engine.state.actions = 1;

    const eventsBefore = engine.eventLog.length;

    engine.dispatch({ type: "PLAY_ACTION", playerId: "human", card: "Market" });

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

    engine.subscribe(events => {
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
    forked.state.players.human!.hand = ["Village"];
    forked.state.actions = 1;

    forked.dispatch({
      type: "PLAY_ACTION",
      playerId: "human",
      card: "Village",
    });

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
    const initialPlayer = engine.state.activePlayerId;

    // Give human some cards
    engine.state.players.human!.hand = ["Village", "Copper"];
    engine.state.players.human!.deck = ["Estate", "Duchy"];
    engine.state.actions = 1;

    // Action phase
    const playResult = engine.dispatch({
      type: "PLAY_ACTION",
      playerId: "human",
      card: "Village",
    });
    expect(playResult.ok).toBe(true);

    // End action phase
    const endActionResult = engine.dispatch({
      type: "END_PHASE",
      playerId: "human",
    });
    expect(endActionResult.ok).toBe(true);
    expect(engine.state.phase).toBe("buy");

    // Buy phase - play treasure
    engine.state.players.human!.hand = ["Copper"];
    const playTreasureResult = engine.dispatch({
      type: "PLAY_TREASURE",
      playerId: "human",
      card: "Copper",
    });
    expect(playTreasureResult.ok).toBe(true);
    expect(engine.state.coins).toBeGreaterThan(0);

    // End buy phase (ends turn)
    engine.state.players.human!.deck = [
      "Estate",
      "Duchy",
      "Province",
      "Copper",
      "Silver",
    ];
    const endTurnResult = engine.dispatch({
      type: "END_PHASE",
      playerId: "human",
    });
    expect(endTurnResult.ok).toBe(true);

    // Should have moved to next turn
    expect(engine.state.turn).toBe(initialTurn + 1);
    expect(engine.state.activePlayerId).not.toBe(initialPlayer);
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
    Array.from({ length: 10 }).forEach(() => {
      engine.state.players.human!.hand = ["Festival"];
      engine.state.actions = 1;

      const result = engine.dispatch({
        type: "PLAY_ACTION",
        playerId: "human",
        card: "Festival",
      });

      expect(result.ok).toBe(true);
      // State should always be valid
      expect(engine.state).toBeDefined();
      expect(engine.state.players).toBeDefined();
    });

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

describe("DominionEngine - Getters", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should return gameId from first event ID", () => {
    const engine = new DominionEngine();
    expect(engine.gameId).toBeUndefined();

    engine.startGame(["human", "ai"]);

    expect(engine.gameId).toBeDefined();
    expect(engine.gameId).toBe(engine.eventLog[0]?.id);
  });

  it("should return undoRequest when pending", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    expect(engine.undoRequest).toBeNull();

    // Request an undo
    const eventId = engine.eventLog[0]?.id || "";
    engine.requestUndo("human", eventId);

    expect(engine.undoRequest).toBeDefined();
    expect(engine.undoRequest?.byPlayer).toBe("human");
  });
});

describe("DominionEngine - Helper Methods", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should playAction via helper method", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    engine.state.players.human!.hand = ["Village"];
    engine.state.actions = 1;

    const result = engine.playAction("human", "Village");

    expect(result.ok).toBe(true);
  });

  it("should playTreasure via helper method", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    engine.state.phase = "buy";
    engine.state.players.human!.hand = ["Copper"];

    const result = engine.playTreasure("human", "Copper");

    expect(result.ok).toBe(true);
  });

  it("should playAllTreasures via helper method", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    engine.state.phase = "buy";
    engine.state.players.human!.hand = ["Copper", "Silver"];

    const result = engine.playAllTreasures("human");

    expect(result.ok).toBe(true);
  });

  it("should buyCard via helper method", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    engine.state.phase = "buy";
    engine.state.coins = 5;
    engine.state.buys = 1;

    const result = engine.buyCard("human", "Silver");

    expect(result.ok).toBe(true);
  });

  it("should endPhase via helper method", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const result = engine.endPhase("human");

    expect(result.ok).toBe(true);
  });

  it("should submitDecision via helper method", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    // Create a decision
    engine.state.players.human!.hand = ["Cellar", "Estate"];
    engine.state.actions = 1;
    engine.playAction("human", "Cellar");

    const result = engine.submitDecision("human", {
      type: "cards",
      selectedCards: [],
    });

    expect(result.ok).toBe(true);
  });

  it("should skipDecision via helper method", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    // Create a decision
    engine.state.players.human!.hand = ["Cellar", "Estate"];
    engine.state.actions = 1;
    engine.playAction("human", "Cellar");

    // Submit the first decision to clear pending state
    engine.submitDecision("human", { type: "cards", selectedCards: [] });

    // Create another decision for skip test
    engine.state.players.human!.hand = ["Cellar", "Copper"];
    engine.state.actions = 1;
    engine.playAction("human", "Cellar");

    const result = engine.skipDecision("human");

    expect(result.ok).toBe(true);
  });
});

describe("DominionEngine - Undo System", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should request undo to event", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const targetEventId = engine.eventLog[2]?.id || "";

    const result = engine.requestUndo("human", targetEventId, "test reason");

    expect(result.ok).toBe(true);
    expect(engine.undoRequest).toBeDefined();
    expect(engine.undoRequest?.byPlayer).toBe("human");
    expect(engine.undoRequest?.toEventId).toBe(targetEventId);
    expect(engine.undoRequest?.reason).toBe("test reason");
  });

  it("should reject simultaneous undo requests", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const eventId = engine.eventLog[2]?.id || "";

    engine.requestUndo("human", eventId);
    const result = engine.requestUndo("ai", eventId);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("An undo request is already pending");
  });

  it("should approve undo via helper method", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const eventId = engine.eventLog[2]?.id || "";
    const request = engine.requestUndo("human", eventId);
    const requestEvent = request.events.find(e => e.type === "UNDO_REQUESTED");
    const requestId =
      requestEvent && "requestId" in requestEvent ? requestEvent.requestId : "";

    const result = engine.approveUndo("ai", requestId);

    expect(result.ok).toBe(true);
  });

  it("should deny undo via helper method", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const eventId = engine.eventLog[2]?.id || "";
    const request = engine.requestUndo("human", eventId);
    const requestEvent = request.events.find(e => e.type === "UNDO_REQUESTED");
    const requestId =
      requestEvent && "requestId" in requestEvent ? requestEvent.requestId : "";

    const result = engine.denyUndo("ai", requestId);

    expect(result.ok).toBe(true);
    expect(engine.undoRequest).toBeNull();
  });

  it("should reject approve without pending request", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const result = engine.dispatch({
      type: "APPROVE_UNDO",
      playerId: "ai",
      requestId: "fake-id",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("No pending undo request");
  });

  it("should reject mismatched request ID", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const eventId = engine.eventLog[2]?.id || "";
    engine.requestUndo("human", eventId);

    const result = engine.dispatch({
      type: "APPROVE_UNDO",
      playerId: "ai",
      requestId: "wrong-id",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Request ID mismatch");
  });

  it("should execute undo when all approvals received", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const eventCountBefore = engine.eventLog.length;
    const eventId = engine.eventLog[2]?.id || "";
    const request = engine.requestUndo("human", eventId);
    const requestEvent = request.events.find(e => e.type === "UNDO_REQUESTED");
    const requestId =
      requestEvent && "requestId" in requestEvent ? requestEvent.requestId : "";

    engine.approveUndo("ai", requestId);

    // Events should have been removed
    expect(engine.eventLog.length).toBeLessThan(eventCountBefore);
  });

  it("should undo to event directly", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const eventCountBefore = engine.eventLog.length;
    const eventId = engine.eventLog[2]?.id || "";

    engine.undoToEvent(eventId);

    expect(engine.eventLog.length).toBeLessThan(eventCountBefore);
  });
});

describe("DominionEngine - State at Event", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should get state at specific event", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const eventId = engine.eventLog[2]?.id || "";
    const state = engine.getStateAtEvent(eventId);

    expect(state).toBeDefined();
    expect(state.turn).toBe(1);
  });

  it("should throw error for non-existent event", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    expect(() => engine.getStateAtEvent("fake-id")).toThrow(
      "Event fake-id not found",
    );
  });
});

describe("DominionEngine - Auto-advance Phase", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should auto-advance when no action cards", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    engine.state.phase = "action";
    engine.state.actions = 1;
    engine.state.players.human!.hand = ["Copper", "Estate"];

    expect(engine.shouldAutoAdvancePhase("human")).toBe(true);
  });

  it("should auto-advance when no actions remaining", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    engine.state.phase = "action";
    engine.state.actions = 0;
    engine.state.players.human!.hand = ["Village"];

    expect(engine.shouldAutoAdvancePhase("human")).toBe(true);
  });

  it("should not auto-advance when actions and action cards available", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    engine.state.phase = "action";
    engine.state.actions = 1;
    engine.state.players.human!.hand = ["Village"];

    expect(engine.shouldAutoAdvancePhase("human")).toBe(false);
  });

  it("should not auto-advance in buy phase", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    engine.state.phase = "buy";

    expect(engine.shouldAutoAdvancePhase("human")).toBe(false);
  });

  it("should not auto-advance when not active player", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    engine.state.phase = "action";
    engine.state.activePlayerId = "ai";

    expect(engine.shouldAutoAdvancePhase("human")).toBe(false);
  });

  it("should not auto-advance during pending decision", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    engine.state.phase = "action";
    engine.state.pendingChoice = {
      playerId: "human",
      choiceType: "decision",
      from: "hand",
      prompt: "test",
      cardOptions: [],
      min: 0,
      max: 1,
      stage: "test",
    };

    expect(engine.shouldAutoAdvancePhase("human")).toBe(false);
  });

  it("should not auto-advance when game is over", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    engine.state.phase = "action";
    engine.state.gameOver = true;

    expect(engine.shouldAutoAdvancePhase("human")).toBe(false);
  });

  it("should not auto-advance when player not found", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    expect(engine.shouldAutoAdvancePhase("unknown")).toBe(false);
  });
});

describe("DominionEngine - Serialization", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should serialize event log", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const serialized = engine.serialize();

    expect(serialized).toBeDefined();
    expect(typeof serialized).toBe("string");
    expect(JSON.parse(serialized)).toBeInstanceOf(Array);
  });

  it("should deserialize and restore state", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const serialized = engine.serialize();
    const restored = DominionEngine.deserialize(serialized);

    expect(restored.state.turn).toBe(engine.state.turn);
    expect(restored.eventLog.length).toBe(engine.eventLog.length);
  });
});

describe("DominionEngine - Event Loading", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should load events", () => {
    const engine1 = new DominionEngine();
    engine1.startGame(["human", "ai"]);

    const events = [...engine1.eventLog];

    const engine2 = new DominionEngine();
    engine2.loadEvents(events);

    expect(engine2.eventLog.length).toBe(events.length);
    expect(engine2.state.turn).toBe(1);
  });

  it("should notify listeners when loading events", () => {
    const engine = new DominionEngine();
    let notified = false;

    engine.subscribe(() => {
      notified = true;
    });

    const events: GameEvent[] = [
      { type: "GAME_STARTED", id: "evt-1", playerOrder: ["human", "ai"] },
    ];

    engine.loadEvents(events);

    expect(notified).toBe(true);
  });

  it("should load events silently without notifying", () => {
    const engine = new DominionEngine();
    let notified = false;

    engine.subscribe(() => {
      notified = true;
    });

    const events: GameEvent[] = [
      { type: "GAME_STARTED", id: "evt-1", playerOrder: ["human", "ai"] },
    ];

    engine.loadEventsSilently(events);

    expect(notified).toBe(false);
    expect(engine.eventLog.length).toBe(1);
  });

  it("should apply external events", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const initialCount = engine.eventLog.length;

    const externalEvents: GameEvent[] = [
      {
        type: "COINS_MODIFIED",
        newValue: 5,
        cause: { type: "card_ability", card: "Copper" },
      },
    ];

    engine.applyExternalEvents(externalEvents);

    expect(engine.eventLog.length).toBe(initialCount + 1);
  });

  it("should add IDs to external events without IDs", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const externalEvents: GameEvent[] = [
      {
        type: "COINS_MODIFIED",
        newValue: 5,
        cause: { type: "card_ability", card: "Copper" },
      },
    ];

    engine.applyExternalEvents(externalEvents);

    const lastEvent = engine.eventLog[engine.eventLog.length - 1];
    expect(lastEvent?.id).toBeDefined();
  });
});

describe("DominionEngine - createGame Helper", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should create and start game with players", () => {
    const engine = createGame(["human", "ai"]);

    expect(engine).toBeInstanceOf(DominionEngine);
    expect(engine.state.turn).toBe(1);
    expect(engine.state.players.human).toBeDefined();
    expect(engine.state.players.ai).toBeDefined();
  });

  it("should create game with custom kingdom cards", () => {
    const kingdomCards = [
      "Village",
      "Smithy",
      "Market",
      "Festival",
      "Laboratory",
      "Witch",
      "Council Room",
      "Mine",
      "Remodel",
      "Militia",
    ];
    const engine = createGame(["human", "ai"], kingdomCards);

    expect(engine.state.turn).toBe(1);
  });

  it("should create game with seed", () => {
    const engine = createGame(["human", "ai"], undefined, 42);

    expect(engine.state.turn).toBe(1);
  });
});

describe("DominionEngine - Edge Cases", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should handle requestUndo without reason", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const eventId = engine.eventLog[2]?.id || "";
    const result = engine.requestUndo("human", eventId);

    expect(result.ok).toBe(true);
    expect(engine.undoRequest?.reason).toBeUndefined();
  });

  it("should handle failed requestUndo gracefully", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const eventId = engine.eventLog[2]?.id || "";
    engine.requestUndo("human", eventId);

    // Second request should fail
    const result = engine.requestUndo("ai", eventId);

    expect(result.ok).toBe(false);
    // pendingUndo should still be the first request
    expect(engine.undoRequest?.byPlayer).toBe("human");
  });

  it("should handle undo execution with target event not found", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const eventId = engine.eventLog[2]?.id || "";
    const request = engine.requestUndo("human", eventId);
    const requestEvent = request.events.find(e => e.type === "UNDO_REQUESTED");
    const requestId =
      requestEvent && "requestId" in requestEvent ? requestEvent.requestId : "";

    // Manually modify pendingUndo to point to non-existent event
    if (engine.undoRequest) {
      engine.undoRequest.toEventId = "non-existent-id";
    }

    const result = engine.approveUndo("ai", requestId);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Target event not found");
  });

  it("should handle undo with partial approvals", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai", "bot"]);

    const eventId = engine.eventLog[2]?.id || "";
    const request = engine.requestUndo("human", eventId);
    const requestEvent = request.events.find(e => e.type === "UNDO_REQUESTED");
    const requestId =
      requestEvent && "requestId" in requestEvent ? requestEvent.requestId : "";

    // First approval
    const result1 = engine.approveUndo("ai", requestId);
    expect(result1.ok).toBe(true);
    expect(engine.undoRequest).not.toBeNull(); // Still pending

    // Second approval (should execute)
    const result2 = engine.approveUndo("bot", requestId);
    expect(result2.ok).toBe(true);
    expect(engine.undoRequest).toBeNull(); // Now completed
  });

  it("should handle DENY_UNDO command type", () => {
    const engine = new DominionEngine();
    engine.startGame(["human", "ai"]);

    const eventId = engine.eventLog[2]?.id || "";
    const request = engine.requestUndo("human", eventId);
    const requestEvent = request.events.find(e => e.type === "UNDO_REQUESTED");
    const requestId =
      requestEvent && "requestId" in requestEvent ? requestEvent.requestId : "";

    const result = engine.dispatch({
      type: "DENY_UNDO",
      playerId: "ai",
      requestId,
    });

    expect(result.ok).toBe(true);
    expect(engine.undoRequest).toBeNull();
  });

  it("should handle multiple subscribers and notify all", () => {
    const engine = new DominionEngine();
    const calls: number[] = [];

    engine.subscribe(() => calls.push(1));
    engine.subscribe(() => calls.push(2));
    engine.subscribe(() => calls.push(3));

    engine.startGame(["human", "ai"]);

    expect(calls.length).toBe(3);
  });

  it("should pass correct state to all listeners", () => {
    const engine = new DominionEngine();
    const receivedStates: GameEvent[][] = [];

    engine.subscribe((events, state) => {
      receivedStates.push(events);
      expect(state).toBeDefined();
      expect(state.turn).toBeDefined();
    });

    engine.startGame(["human", "ai"]);

    expect(receivedStates.length).toBeGreaterThan(0);
  });

  it("should handle startGame with custom kingdom and seed", () => {
    const engine = new DominionEngine();
    const kingdomCards = [
      "Village",
      "Smithy",
      "Market",
      "Festival",
      "Laboratory",
      "Witch",
      "Council Room",
      "Mine",
      "Remodel",
      "Militia",
    ];

    const result = engine.startGame(["human", "ai"], kingdomCards, 42);

    expect(result.ok).toBe(true);
  });
});
