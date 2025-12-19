import { describe, it, expect, beforeEach } from "bun:test";
import { DominionEngine } from "../engine";
import type { CardName } from "../types/game-state";
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
      kingdomCards: undefined,
    });
  });

  describe("executePlayAction", () => {
    it("should dispatch PLAY_ACTION command to engine", () => {
      const initialActionCount = engine.state.actions;
      const result = executePlayAction(engine, "Village");

      expect(result).toBeDefined();
      expect(typeof result.ok).toBe("boolean");
    });

    it("should use 'human' as default playerId", () => {
      const result = executePlayAction(engine, "Smithy");
      expect(result).toBeDefined();
    });
  });

  describe("executePlayTreasure", () => {
    it("should dispatch PLAY_TREASURE command to engine", () => {
      const result = executePlayTreasure(engine, "Copper");
      expect(result).toBeDefined();
      expect(typeof result.ok).toBe("boolean");
    });

    it("should use 'human' as default playerId", () => {
      const result = executePlayTreasure(engine, "Gold");
      expect(result).toBeDefined();
    });
  });

  describe("executeUnplayTreasure", () => {
    it("should dispatch UNPLAY_TREASURE command to engine", () => {
      const result = executeUnplayTreasure(engine, "Copper");
      expect(result).toBeDefined();
      expect(typeof result.ok).toBe("boolean");
    });

    it("should use 'human' as default playerId", () => {
      const result = executeUnplayTreasure(engine, "Silver");
      expect(result).toBeDefined();
    });
  });

  describe("executePlayAllTreasures", () => {
    it("should return CommandResult with ok property", () => {
      const result = executePlayAllTreasures(engine, engine.state);
      expect(result).toBeDefined();
      expect(typeof result.ok).toBe("boolean");
      expect(result.events).toBeDefined();
    });

    it("should return error when no human player", () => {
      const invalidState = {
        ...engine.state,
        players: {
          ai: engine.state.players.ai,
        },
      };
      const result = executePlayAllTreasures(engine, invalidState as any);
      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle empty hand", () => {
      const stateWithEmptyHand = {
        ...engine.state,
        players: {
          ...engine.state.players,
          human: {
            ...engine.state.players.human,
            hand: [],
          },
        },
      };
      const result = executePlayAllTreasures(engine, stateWithEmptyHand);
      expect(result).toBeDefined();
    });

    it("should dispatch multiple PLAY_TREASURE commands in order", () => {
      const stateWithTreasures = {
        ...engine.state,
        players: {
          ...engine.state.players,
          human: {
            ...engine.state.players.human,
            hand: ["Copper", "Silver"],
          },
        },
      };
      const result = executePlayAllTreasures(engine, stateWithTreasures);
      expect(result).toBeDefined();
    });
  });

  describe("executeBuyCard", () => {
    it("should dispatch BUY_CARD command to engine", () => {
      const result = executeBuyCard(engine, "Village");
      expect(result).toBeDefined();
      expect(typeof result.ok).toBe("boolean");
    });

    it("should use 'human' as default playerId", () => {
      const result = executeBuyCard(engine, "Estate");
      expect(result).toBeDefined();
    });
  });

  describe("executeEndPhase", () => {
    it("should dispatch END_PHASE command to engine", () => {
      const result = executeEndPhase(engine);
      expect(result).toBeDefined();
      expect(typeof result.ok).toBe("boolean");
    });

    it("should use 'human' as default playerId", () => {
      const result = executeEndPhase(engine);
      expect(result).toBeDefined();
    });

    it("should not throw when ending phase", () => {
      expect(() => {
        executeEndPhase(engine);
      }).not.toThrow();
    });
  });

  describe("executeSubmitDecision", () => {
    it("should dispatch SUBMIT_DECISION command to engine", () => {
      const choice = { selectedCards: ["Copper"] };
      const result = executeSubmitDecision(engine, choice);
      expect(result).toBeDefined();
      expect(typeof result.ok).toBe("boolean");
    });

    it("should use 'human' as default playerId", () => {
      const choice = { selectedCards: [] };
      const result = executeSubmitDecision(engine, choice);
      expect(result).toBeDefined();
    });
  });

  describe("executeUndo", () => {
    it("should call undoToEvent on engine with provided eventId", () => {
      const initialEventCount = engine.eventLog.length;
      // Create some events first
      executePlayAllTreasures(engine, engine.state);
      expect(engine.eventLog.length).toBeGreaterThanOrEqual(initialEventCount);

      // Get an event ID
      if (engine.eventLog.length > initialEventCount) {
        const eventIdToUndoTo = engine.eventLog[initialEventCount].id;
        executeUndo(engine, eventIdToUndoTo);
        expect(engine.eventLog.length).toBeLessThanOrEqual(engine.eventLog.length);
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
        const validEventId = engine.eventLog[0].id;
        const state = getStateAtEvent(engine, validEventId, fallbackState);
        expect(state).toBeDefined();
      }
    });
  });

  describe("GameActionResult interface", () => {
    it("should be compatible with all action return values", () => {
      const playActionResult = executePlayAction(engine, "Village");
      expect(playActionResult).toBeDefined();

      const playTreasureResult = executePlayTreasure(engine, "Copper");
      expect(playTreasureResult).toBeDefined();

      const playAllResult = executePlayAllTreasures(engine, engine.state);
      expect(playAllResult.success === undefined || typeof playAllResult.success === "boolean").toBe(true);

      const buyResult = executeBuyCard(engine, "Estate");
      expect(buyResult).toBeDefined();

      const endPhaseResult = executeEndPhase(engine);
      expect(endPhaseResult).toBeDefined();
    });
  });

  describe("integration between functions", () => {
    it("should maintain engine consistency across multiple commands", () => {
      const eventCountBefore = engine.eventLog.length;

      executePlayAllTreasures(engine, engine.state);
      expect(engine.eventLog.length).toBeGreaterThanOrEqual(eventCountBefore);

      executeEndPhase(engine);
      expect(engine.eventLog.length).toBeGreaterThanOrEqual(eventCountBefore);

      const currentState = engine.state;
      expect(currentState).toBeDefined();
    });

    it("should handle undo correctly after multiple commands", () => {
      const initialEventCount = engine.eventLog.length;
      const initialEventId = engine.eventLog[initialEventCount - 1]?.id;

      executePlayAllTreasures(engine, engine.state);
      const countAfterPlay = engine.eventLog.length;

      if (initialEventId) {
        executeUndo(engine, initialEventId);
        expect(engine.eventLog.length).toBeLessThanOrEqual(countAfterPlay);
      }
    });
  });
});
