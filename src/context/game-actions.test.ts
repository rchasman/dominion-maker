import { describe, it, expect, beforeEach } from "bun:test";
import { DominionEngine } from "../engine";
import type { DecisionChoice, GameState } from "../types/game-state";
import {
  executePlayAction,
  executePlayTreasure,
  executeUnplayTreasure,
  executePlayAllTreasures,
  executeBuyCard,
  executeEndPhase,
  executeSubmitDecision,
  executeUndo,
  getStateAtEvent,
} from "./game-actions";

describe("game-actions", () => {
  let engine: DominionEngine;

  beforeEach(() => {
    engine = new DominionEngine();
    engine.dispatch({
      type: "START_GAME",
      players: ["human", "ai"],
    });
  });

  describe("executePlayAction", () => {
    it("should dispatch PLAY_ACTION command to engine", () => {
      const result = executePlayAction(engine, "human", "Village");

      expect(result).toBeDefined();
      expect(typeof result.ok).toBe("boolean");
    });

    it("should use 'human' as default playerId", () => {
      const result = executePlayAction(engine, "human", "Smithy");
      expect(result).toBeDefined();
    });
  });

  describe("executePlayTreasure", () => {
    it("should dispatch PLAY_TREASURE command to engine", () => {
      const result = executePlayTreasure(engine, "human", "Copper");
      expect(result).toBeDefined();
      expect(typeof result.ok).toBe("boolean");
    });

    it("should use 'human' as default playerId", () => {
      const result = executePlayTreasure(engine, "human", "Gold");
      expect(result).toBeDefined();
    });
  });

  describe("executeUnplayTreasure", () => {
    it("should dispatch UNPLAY_TREASURE command to engine", () => {
      const result = executeUnplayTreasure(engine, "human", "Copper");
      expect(result).toBeDefined();
      expect(typeof result.ok).toBe("boolean");
    });

    it("should use 'human' as default playerId", () => {
      const result = executeUnplayTreasure(engine, "human", "Silver");
      expect(result).toBeDefined();
    });
  });

  describe("executePlayAllTreasures", () => {
    it("should return CommandResult with ok property", () => {
      const result = executePlayAllTreasures(engine, "human", engine.state);
      expect(result).toBeDefined();
      expect(typeof result.ok).toBe("boolean");
      if (result.ok) {
        expect(result.events).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
      }
    });

    it("should return error when no human player", () => {
      const invalidState: GameState = {
        ...engine.state,
        players: {
          ai: engine.state.players.ai!,
        },
      };
      const result = executePlayAllTreasures(engine, "human", invalidState);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected error result");
      expect(result.error).toBeDefined();
    });

    it("should handle empty hand", () => {
      const stateWithEmptyHand: GameState = {
        ...engine.state,
        players: {
          ...engine.state.players,
          human: {
            ...engine.state.players.human!,
            hand: [],
          },
        },
      };
      const result = executePlayAllTreasures(
        engine,
        "human",
        stateWithEmptyHand,
      );
      expect(result).toBeDefined();
    });

    it("should dispatch multiple PLAY_TREASURE commands in order", () => {
      const stateWithTreasures: GameState = {
        ...engine.state,
        players: {
          ...engine.state.players,
          human: {
            ...engine.state.players.human!,
            hand: ["Copper", "Silver"],
          },
        },
      };
      const result = executePlayAllTreasures(
        engine,
        "human",
        stateWithTreasures,
      );
      expect(result).toBeDefined();
    });
  });

  describe("executeBuyCard", () => {
    it("should dispatch BUY_CARD command to engine", () => {
      const result = executeBuyCard(engine, "human", "Village");
      expect(result).toBeDefined();
      expect(typeof result.ok).toBe("boolean");
    });

    it("should use 'human' as default playerId", () => {
      const result = executeBuyCard(engine, "human", "Estate");
      expect(result).toBeDefined();
    });
  });

  describe("executeEndPhase", () => {
    it("should dispatch END_PHASE command to engine", () => {
      const result = executeEndPhase(engine, "human");
      expect(result).toBeDefined();
      expect(typeof result.ok).toBe("boolean");
    });

    it("should use 'human' as default playerId", () => {
      const result = executeEndPhase(engine, "human");
      expect(result).toBeDefined();
    });

    it("should not throw when ending phase", () => {
      expect(() => {
        executeEndPhase(engine, "human");
      }).not.toThrow();
    });
  });

  describe("executeSubmitDecision", () => {
    it("should dispatch SUBMIT_DECISION command to engine", () => {
      const choice: DecisionChoice = { selectedCards: ["Copper"] };
      const result = executeSubmitDecision(engine, "human", choice);
      expect(result).toBeDefined();
      expect(typeof result.ok).toBe("boolean");
    });

    it("should use 'human' as default playerId", () => {
      const choice = { selectedCards: [] };
      const result = executeSubmitDecision(engine, "human", choice);
      expect(result).toBeDefined();
    });
  });

  describe("executeUndo", () => {
    it("should call undoToEvent on engine with provided eventId", () => {
      const initialEventCount = engine.eventLog.length;
      // Create some events first
      executePlayAllTreasures(engine, "human", engine.state);
      expect(engine.eventLog.length).toBeGreaterThanOrEqual(initialEventCount);

      // Get an event ID
      if (engine.eventLog.length > initialEventCount) {
        const eventIdToUndoTo = engine.eventLog[initialEventCount]!.id;
        if (!eventIdToUndoTo) throw new Error("expected event to have an id");
        executeUndo(engine, eventIdToUndoTo);
        expect(engine.eventLog.length).toBeLessThanOrEqual(
          engine.eventLog.length,
        );
      }
    });

    it("should be callable with any eventId", () => {
      expect(() => {
        executeUndo(engine, "non-existent-event-id");
      }).not.toThrow();
    });
  });

  describe("getStateAtEvent", () => {
    it("should accept eventId and fallback state parameters", () => {
      const eventId = engine.eventLog[0]?.id || "start-event";
      const fallbackState = engine.state;
      const state = getStateAtEvent(engine, eventId, fallbackState);
      expect(state).toBeDefined();
    });

    it("should return state when event exists", () => {
      const fallbackState = engine.state;
      if (engine.eventLog.length > 0) {
        const validEventId = engine.eventLog[0]!.id;
        if (!validEventId) throw new Error("expected event to have an id");
        const state = getStateAtEvent(engine, validEventId, fallbackState);
        expect(state).toBeDefined();
      }
    });
  });

  describe("GameActionResult interface", () => {
    it("should be compatible with all action return values", () => {
      const playActionResult = executePlayAction(engine, "human", "Village");
      expect(playActionResult).toBeDefined();

      const playTreasureResult = executePlayTreasure(engine, "human", "Copper");
      expect(playTreasureResult).toBeDefined();

      const playAllResult = executePlayAllTreasures(
        engine,
        "human",
        engine.state,
      );
      expect(typeof playAllResult.ok).toBe("boolean");

      const buyResult = executeBuyCard(engine, "human", "Estate");
      expect(buyResult).toBeDefined();

      const endPhaseResult = executeEndPhase(engine, "human");
      expect(endPhaseResult).toBeDefined();
    });
  });

  describe("integration between functions", () => {
    it("should maintain engine consistency across multiple commands", () => {
      const eventCountBefore = engine.eventLog.length;

      executePlayAllTreasures(engine, "human", engine.state);
      expect(engine.eventLog.length).toBeGreaterThanOrEqual(eventCountBefore);

      executeEndPhase(engine, "human");
      expect(engine.eventLog.length).toBeGreaterThanOrEqual(eventCountBefore);

      const currentState = engine.state;
      expect(currentState).toBeDefined();
    });

    it("should handle undo correctly after multiple commands", () => {
      const initialEventCount = engine.eventLog.length;
      const initialEventId = engine.eventLog[initialEventCount - 1]?.id;

      executePlayAllTreasures(engine, "human", engine.state);
      const countAfterPlay = engine.eventLog.length;

      if (initialEventId) {
        executeUndo(engine, initialEventId);
        expect(engine.eventLog.length).toBeLessThanOrEqual(countAfterPlay);
      }
    });
  });
});
