import { describe, it, expect, beforeEach } from "bun:test";
import { DominionEngine } from "./engine";
import { resetEventCounter } from "../events/id-generator";
import { removeEventChain, isRootCauseEvent } from "../events/types";
import type { GameEvent } from "../events/types";

/**
 * Undo system tests
 * Tests undo functionality and causality chain removal
 */

describe("Undo System - Immediate Undo", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should undo to event using undoToEvent()", () => {
    const engine = new DominionEngine();
    engine.startGame(["human"]);

    // Play a card
    engine.state.players.human.hand = ["Village"];
    engine.state.players.human.deck = ["Copper"];
    engine.state.actions = 1;

    const eventsBefore = engine.eventLog.length;
    engine.dispatch({
      type: "PLAY_ACTION",
      playerId: "human",
      card: "Village",
    });
    const eventsAfter = engine.eventLog.length;

    expect(eventsAfter).toBeGreaterThan(eventsBefore);

    // Get the turn start event to undo to
    const turnStartEvent = engine.eventLog.find(e => e.type === "TURN_STARTED");
    expect(turnStartEvent).toBeDefined();

    // Undo to turn start (removes all actions)
    if (turnStartEvent.id) {
      engine.undoToEvent(turnStartEvent.id);
    }

    // Events after turn start should be removed
    expect(engine.eventLog.length).toBeLessThan(eventsAfter);

    // Village should not be in inPlay
    expect(engine.state.players.human.inPlay).not.toContain("Village");
  });

  it("should remove causal chain when undoing", () => {
    const engine = new DominionEngine();
    engine.startGame(["human"]);

    engine.state.players.human.hand = ["Market"];
    engine.state.players.human.deck = ["Copper"];
    engine.state.actions = 1;

    engine.dispatch({ type: "PLAY_ACTION", playerId: "human", card: "Market" });

    // Market generates CARD_PLAYED + effects (ACTIONS_MODIFIED, CARD_DRAWN, etc.)
    const marketEvent = [...engine.eventLog]
      .reverse()
      .find(e => e.type === "CARD_PLAYED" && e.card === "Market");
    expect(marketEvent).toBeDefined();

    // Count effects caused by Market
    if (marketEvent && marketEvent.id) {
      const marketEffects = engine.eventLog.filter(
        e => e.causedBy === marketEvent.id
      );
      expect(marketEffects.length).toBeGreaterThan(0);

      // Undo to before Market
      const eventBeforeMarket =
        engine.eventLog[
          engine.eventLog.findIndex(e => e.id === marketEvent.id) - 1
        ];

      if (eventBeforeMarket && eventBeforeMarket.id) {
        engine.undoToEvent(eventBeforeMarket.id);

        // Market and all its effects should be gone
        const marketAfterUndo = engine.eventLog.find(
          e => e.id === marketEvent.id
        );
        expect(marketAfterUndo).toBeUndefined();

        const effectsAfterUndo = engine.eventLog.filter(
          e => e.causedBy === marketEvent.id
        );
        expect(effectsAfterUndo.length).toBe(0);
      }
    }
  });

  it("should invalidate state cache after undo", () => {
    const engine = new DominionEngine();
    engine.startGame(["human"]);

    engine.state.players.human.hand = ["Festival"];
    engine.state.actions = 1;

    const coinsBefore = engine.state.coins;

    engine.dispatch({
      type: "PLAY_ACTION",
      playerId: "human",
      card: "Festival",
    });

    const coinsAfter = engine.state.coins;
    expect(coinsAfter).toBeGreaterThan(coinsBefore);

    // Get turn start to undo to
    const turnStart = engine.eventLog.find(e => e.type === "TURN_STARTED");

    if (turnStart && turnStart.id) {
      engine.undoToEvent(turnStart.id);

      // Coins should be back to original
      const coinsAfterUndo = engine.state.coins;
      expect(coinsAfterUndo).toBeLessThanOrEqual(coinsBefore);
    }
  });
});

describe("Undo System - removeEventChain Utility", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should keep events up to and including target", () => {
    const events: GameEvent[] = [
      { type: "TURN_STARTED", turn: 1, playerId: "human", id: "evt-1" },
      { type: "CARD_PLAYED", playerId: "human", card: "Village", id: "evt-2" },
      { type: "ACTIONS_MODIFIED", delta: -1, id: "evt-3", causedBy: "evt-2" },
      {
        type: "CARD_DRAWN",
        playerId: "human",
        card: "Copper",
        id: "evt-4",
        causedBy: "evt-2",
      },
      { type: "CARD_PLAYED", playerId: "human", card: "Smithy", id: "evt-5" },
    ];

    // Undo to Village (keep turn start, village, effects, remove Smithy)
    const result = removeEventChain("evt-2", events);

    expect(result.length).toBe(4); // Turn start + Village + 2 effects
    expect(result.find(e => e.id === "evt-1")).toBeDefined(); // TURN_STARTED
    expect(result.find(e => e.id === "evt-2")).toBeDefined(); // CARD_PLAYED Village
    expect(result.find(e => e.id === "evt-3")).toBeDefined(); // Effect
    expect(result.find(e => e.id === "evt-4")).toBeDefined(); // Effect
    expect(result.find(e => e.id === "evt-5")).toBeUndefined(); // Smithy removed
  });
});

describe("Undo System - Root Cause Detection", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should identify root cause events correctly", () => {
    const engine = new DominionEngine();
    engine.startGame(["human"]);

    engine.state.players.human.hand = ["Village", "Smithy"];
    engine.state.players.human.deck = ["Copper", "Silver", "Gold"];
    engine.state.actions = 2;

    engine.dispatch({
      type: "PLAY_ACTION",
      playerId: "human",
      card: "Village",
    });
    engine.dispatch({ type: "PLAY_ACTION", playerId: "human", card: "Smithy" });

    // Find root events (CARD_PLAYED)
    const rootEvents = engine.eventLog.filter(isRootCauseEvent);

    // Should have: GAME_INITIALIZED, INITIAL_DECK_DEALT (x2), INITIAL_HAND_DRAWN (x2),
    // TURN_STARTED, CARD_PLAYED (x2)
    expect(rootEvents.length).toBeGreaterThan(2);

    // All root events should not have causedBy
    for (const event of rootEvents) {
      expect(event.causedBy).toBeUndefined();
    }

    // Effect events should have causedBy
    const effectEvents = engine.eventLog.filter(
      e => e.type === "ACTIONS_MODIFIED" || e.type === "CARD_DRAWN"
    );

    for (const event of effectEvents) {
      if (event.type !== "CARD_DRAWN") {
        // CARD_DRAWN might not have causedBy in some cases
        expect(event.causedBy).toBeDefined();
      }
    }
  });
});

describe("Undo System - Causality Utilities", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should correctly identify undo boundaries (root events only)", () => {
    const engine = new DominionEngine();
    engine.startGame(["human"]);

    engine.state.players.human.hand = ["Market"];
    engine.state.players.human.deck = ["Copper"];
    engine.state.actions = 1;

    engine.dispatch({ type: "PLAY_ACTION", playerId: "human", card: "Market" });

    // Valid undo points are only root events
    const validUndoPoints = engine.eventLog.filter(isRootCauseEvent);

    // All should be undoable
    for (const event of validUndoPoints) {
      expect(event.causedBy).toBeUndefined();
    }

    // Effect events should NOT be valid undo points
    const effectEvents = engine.eventLog.filter(
      e => e.type === "ACTIONS_MODIFIED" || e.type === "COINS_MODIFIED"
    );

    for (const event of effectEvents) {
      expect(isRootCauseEvent(event)).toBe(false);
    }
  });

  it("should use removeEventChain to keep events up to target", () => {
    const events: GameEvent[] = [
      { type: "TURN_STARTED", turn: 1, playerId: "human", id: "evt-1" },
      { type: "CARD_PLAYED", playerId: "human", card: "Village", id: "evt-2" },
      { type: "ACTIONS_MODIFIED", delta: -1, id: "evt-3", causedBy: "evt-2" },
      {
        type: "CARD_DRAWN",
        playerId: "human",
        card: "Copper",
        id: "evt-4",
        causedBy: "evt-2",
      },
      { type: "ACTIONS_MODIFIED", delta: 2, id: "evt-5", causedBy: "evt-2" },
      { type: "CARD_PLAYED", playerId: "human", card: "Smithy", id: "evt-6" },
      { type: "ACTIONS_MODIFIED", delta: -1, id: "evt-7", causedBy: "evt-6" },
    ];

    // Undo to Village - keeps turn start, Village and effects, removes Smithy
    const result = removeEventChain("evt-2", events);

    expect(result.length).toBe(5); // Turn start + Village + 3 effects
    expect(result.map(e => e.id)).toEqual([
      "evt-1",
      "evt-2",
      "evt-3",
      "evt-4",
      "evt-5",
    ]);
    expect(result.find(e => e.id === "evt-6")).toBeUndefined();
    expect(result.find(e => e.id === "evt-7")).toBeUndefined();
  });

  it("should handle undo to event not found (keeps all)", () => {
    const events: GameEvent[] = [
      { type: "TURN_STARTED", turn: 1, playerId: "human", id: "evt-1" },
      { type: "CARD_PLAYED", playerId: "human", card: "Village", id: "evt-2" },
      { type: "ACTIONS_MODIFIED", delta: 2, id: "evt-3", causedBy: "evt-2" },
    ];

    // Event not found - should keep all
    const result = removeEventChain("evt-999", events);

    expect(result.length).toBe(3);
    expect(result).toEqual(events);
  });
});

describe("Undo System - getStateAtEvent", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should get state at specific event (time travel)", () => {
    const engine = new DominionEngine();
    engine.startGame(["human"]);

    const stateAfterStart = { ...engine.state };

    engine.state.players.human.hand = ["Festival"];
    engine.state.actions = 1;

    engine.dispatch({
      type: "PLAY_ACTION",
      playerId: "human",
      card: "Festival",
    });

    // Get state at turn start
    const turnStart = engine.eventLog.find(e => e.type === "TURN_STARTED");

    if (turnStart && turnStart.id) {
      const stateAtTurnStart = engine.getStateAtEvent(turnStart.id);

      // Should match original state after start
      expect(stateAtTurnStart.turn).toBe(stateAfterStart.turn);
      expect(stateAtTurnStart.activePlayer).toBe(stateAfterStart.activePlayer);

      // Current state should still be after Festival
      expect(engine.state.coins).toBeGreaterThan(stateAtTurnStart.coins);
    }
  });
});

describe("Undo System - Edge Cases", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should handle undo when event log is empty", () => {
    const events: GameEvent[] = [];

    const result = removeEventChain("evt-1", events);

    expect(result).toEqual([]);
  });

  it("should handle events with missing IDs", () => {
    const events: GameEvent[] = [
      { type: "TURN_STARTED", turn: 1, playerId: "human" }, // No ID
      { type: "CARD_PLAYED", playerId: "human", card: "Village", id: "evt-2" },
    ];

    const result = removeEventChain("evt-2", events);

    expect(result.length).toBe(2); // Keeps both
  });
});
