import { describe, it, expect, beforeEach } from "bun:test";
import {
  createEmptyState,
  projectState,
  getEventsForTurn,
  findTurnStartIndex,
  countEventsByType,
} from "./project";
import { resetEventCounter } from "./id-generator";
import type { GameEvent } from "./types";
import type { GameState } from "../types/game-state";

describe("project", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  describe("createEmptyState", () => {
    it("creates initial game state with default values", () => {
      const state = createEmptyState();

      expect(state.turn).toBe(0);
      expect(state.phase).toBe("action");
      expect(state.activePlayerId).toBe("human");
      expect(state.players).toEqual({});
      expect(state.supply).toEqual({});
      expect(state.trash).toEqual([]);
      expect(state.kingdomCards).toEqual([]);
      expect(state.actions).toBe(0);
      expect(state.buys).toBe(0);
      expect(state.coins).toBe(0);
      expect(state.pendingChoice).toBeNull();
      expect(state.pendingChoiceEventId).toBeNull();
      expect(state.gameOver).toBe(false);
      expect(state.winnerId).toBeNull();
      expect(state.log).toEqual([]);
      expect(state.turnHistory).toEqual([]);
      expect(state.playerOrder).toEqual([]);
      expect(state.activeEffects).toEqual([]);
    });

    it("creates new object on each call", () => {
      const state1 = createEmptyState();
      const state2 = createEmptyState();

      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });

  describe("projectState", () => {
    it("projects empty state from empty events", () => {
      const state = projectState([]);

      expect(state.turn).toBe(0);
      expect(state.players).toEqual({});
    });

    it("projects state from GAME_INITIALIZED event", () => {
      const events: GameEvent[] = [
        {
          type: "GAME_INITIALIZED",
          players: ["human", "ai"],
          kingdomCards: ["Village", "Smithy"],
          supply: { Copper: 46, Estate: 8 },
        },
      ];

      const state = projectState(events);

      expect(state.players.human).toBeDefined();
      expect(state.players.ai).toBeDefined();
      expect(state.kingdomCards).toEqual(["Village", "Smithy"]);
      expect(state.supply).toEqual({ Copper: 46, Estate: 8 });
    });

    it("projects state from multiple events", () => {
      const events: GameEvent[] = [
        {
          type: "GAME_INITIALIZED",
          players: ["human", "ai"],
          kingdomCards: [],
          supply: { Copper: 46 },
        },
        {
          type: "TURN_STARTED",
          turn: 1,
          playerId: "human",
        },
        {
          type: "ACTIONS_MODIFIED",
          delta: 2,
        },
        {
          type: "BUYS_MODIFIED",
          delta: 1,
        },
      ];

      const state = projectState(events);

      expect(state.turn).toBe(1);
      expect(state.activePlayerId).toBe("human");
      expect(state.actions).toBe(2);
      expect(state.buys).toBe(1);
    });

    it("applies events in sequence", () => {
      const events: GameEvent[] = [
        {
          type: "GAME_INITIALIZED",
          players: ["human"],
          kingdomCards: [],
          supply: {},
        },
        {
          type: "INITIAL_DECK_DEALT",
          playerId: "human",
          cards: ["Estate", "Copper", "Copper"],
        },
        {
          type: "INITIAL_HAND_DRAWN",
          playerId: "human",
          cards: ["Copper", "Copper"],
        },
      ];

      const state = projectState(events);

      expect(state.players.human!.hand).toEqual(["Copper", "Copper"]);
      // INITIAL_HAND_DRAWN removes last 2 cards from deck
      expect(state.players.human!.deck.length).toBe(1);
      expect(state.players.human!.deck).toEqual(["Estate"]);
    });

    it("rebuilds log from events with causality", () => {
      const events: GameEvent[] = [
        {
          id: "evt-1",
          type: "TURN_STARTED",
          turn: 1,
          playerId: "human",
        },
        {
          id: "evt-2",
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Village",
          sourceIndex: 0,
        },
        {
          id: "evt-3",
          type: "ACTIONS_MODIFIED",
          delta: 2,
          causedBy: "evt-2",
        },
      ];

      const state = projectState(events);

      expect(state.log.length).toBeGreaterThan(0);
      // Log should have nested structure based on causality
      const playActionLog = state.log.find(
        entry => entry.type === "play-action",
      );
      expect(playActionLog).toBeDefined();
    });

    it("handles complex event chain", () => {
      const events: GameEvent[] = [
        {
          type: "GAME_INITIALIZED",
          players: ["human"],
          kingdomCards: [],
          supply: { Silver: 40 },
        },
        {
          type: "INITIAL_DECK_DEALT",
          playerId: "human",
          cards: ["Copper", "Silver", "Estate"],
        },
        {
          type: "INITIAL_HAND_DRAWN",
          playerId: "human",
          cards: ["Copper", "Silver"],
        },
        {
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Estate",
        },
        {
          type: "CARD_GAINED",
          playerId: "human",
          card: "Silver",
          to: "discard",
        },
      ];

      const state = projectState(events);

      expect(state.players.human!.hand).toEqual(["Copper", "Silver", "Estate"]);
      expect(state.players.human!.discard).toEqual(["Silver"]);
      expect(state.supply.Silver).toBe(39);
    });
  });

  describe("getEventsForTurn", () => {
    const createTurnEvents = (): GameEvent[] => [
      {
        type: "TURN_STARTED",
        turn: 1,
        playerId: "human",
      },
      {
        type: "CARD_PLAYED",
        playerId: "human",
        card: "Village",
        sourceIndex: 0,
      },
      {
        type: "ACTIONS_MODIFIED",
        delta: 1,
      },
      {
        type: "TURN_ENDED",
        turn: 1,
        playerId: "human",
      },
      {
        type: "TURN_STARTED",
        turn: 2,
        playerId: "ai",
      },
      {
        type: "CARD_PLAYED",
        playerId: "ai",
        card: "Smithy",
        sourceIndex: 0,
      },
      {
        type: "TURN_ENDED",
        turn: 2,
        playerId: "ai",
      },
      {
        type: "TURN_STARTED",
        turn: 3,
        playerId: "human",
      },
    ];

    it("gets events for turn 1", () => {
      const events = createTurnEvents();
      const turnEvents = getEventsForTurn(events, 1);

      expect(turnEvents.length).toBe(4);
      expect(turnEvents[0]!.type).toBe("TURN_STARTED");
      expect(turnEvents[3]!.type).toBe("TURN_ENDED");
    });

    it("gets events for turn 2", () => {
      const events = createTurnEvents();
      const turnEvents = getEventsForTurn(events, 2);

      expect(turnEvents.length).toBe(3);
      expect(turnEvents[0]!.type).toBe("TURN_STARTED");
      expect((turnEvents[0] as any).playerId).toBe("ai");
    });

    it("returns empty array for non-existent turn", () => {
      const events = createTurnEvents();
      const turnEvents = getEventsForTurn(events, 99);

      expect(turnEvents).toEqual([]);
    });

    it("handles turn 0 (no events)", () => {
      const events = createTurnEvents();
      const turnEvents = getEventsForTurn(events, 0);

      expect(turnEvents).toEqual([]);
    });

    it("handles empty event array", () => {
      const turnEvents = getEventsForTurn([], 1);

      expect(turnEvents).toEqual([]);
    });

    it("handles events without TURN_STARTED", () => {
      const events: GameEvent[] = [
        {
          type: "ACTIONS_MODIFIED",
          delta: 1,
        },
        {
          type: "BUYS_MODIFIED",
          delta: 1,
        },
      ];

      const turnEvents = getEventsForTurn(events, 1);

      expect(turnEvents).toEqual([]);
    });

    it("gets all events up to next turn start", () => {
      const events: GameEvent[] = [
        {
          type: "TURN_STARTED",
          turn: 1,
          playerId: "human",
        },
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Village",
          sourceIndex: 0,
        },
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Smithy",
          sourceIndex: 0,
        },
        {
          type: "TURN_STARTED",
          turn: 2,
          playerId: "ai",
        },
      ];

      const turnEvents = getEventsForTurn(events, 1);

      expect(turnEvents.length).toBe(3);
    });
  });

  describe("findTurnStartIndex", () => {
    it("finds index of TURN_STARTED event", () => {
      const events: GameEvent[] = [
        {
          type: "ACTIONS_MODIFIED",
          delta: 1,
        },
        {
          type: "TURN_STARTED",
          turn: 1,
          playerId: "human",
        },
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Village",
          sourceIndex: 0,
        },
      ];

      const index = findTurnStartIndex(events, 1);

      expect(index).toBe(1);
    });

    it("returns -1 for non-existent turn", () => {
      const events: GameEvent[] = [
        {
          type: "TURN_STARTED",
          turn: 1,
          playerId: "human",
        },
      ];

      const index = findTurnStartIndex(events, 99);

      expect(index).toBe(-1);
    });

    it("returns -1 for empty event array", () => {
      const index = findTurnStartIndex([], 1);

      expect(index).toBe(-1);
    });

    it("finds first occurrence when multiple turns exist", () => {
      const events: GameEvent[] = [
        {
          type: "TURN_STARTED",
          turn: 1,
          playerId: "human",
        },
        {
          type: "TURN_STARTED",
          turn: 2,
          playerId: "ai",
        },
        {
          type: "TURN_STARTED",
          turn: 3,
          playerId: "human",
        },
      ];

      const index = findTurnStartIndex(events, 2);

      expect(index).toBe(1);
    });

    it("handles turn 0", () => {
      const events: GameEvent[] = [
        {
          type: "TURN_STARTED",
          turn: 0,
          playerId: "human",
        },
      ];

      const index = findTurnStartIndex(events, 0);

      expect(index).toBe(0);
    });
  });

  describe("countEventsByType", () => {
    it("counts events by type", () => {
      const events: GameEvent[] = [
        {
          type: "TURN_STARTED",
          turn: 1,
          playerId: "human",
        },
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Village",
          sourceIndex: 0,
        },
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Smithy",
          sourceIndex: 0,
        },
        {
          type: "ACTIONS_MODIFIED",
          delta: 1,
        },
        {
          type: "TURN_ENDED",
          turn: 1,
          playerId: "human",
        },
      ];

      const counts = countEventsByType(events);

      expect(counts.TURN_STARTED).toBe(1);
      expect(counts.CARD_PLAYED).toBe(2);
      expect(counts.ACTIONS_MODIFIED).toBe(1);
      expect(counts.TURN_ENDED).toBe(1);
    });

    it("returns empty object for empty events", () => {
      const counts = countEventsByType([]);

      expect(counts).toEqual({});
    });

    it("handles single event type", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Copper",
        },
        {
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Silver",
        },
        {
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Gold",
        },
      ];

      const counts = countEventsByType(events);

      expect(counts.CARD_DRAWN).toBe(3);
      expect(Object.keys(counts).length).toBe(1);
    });

    it("handles many different event types", () => {
      const events: GameEvent[] = [
        {
          type: "GAME_INITIALIZED",
          players: ["human"],
          kingdomCards: [],
          supply: {},
        },
        {
          type: "TURN_STARTED",
          turn: 1,
          playerId: "human",
        },
        {
          type: "PHASE_CHANGED",
          phase: "buy",
        },
        {
          type: "CARD_GAINED",
          playerId: "human",
          card: "Silver",
          to: "discard",
        },
        {
          type: "TURN_ENDED",
          turn: 1,
          playerId: "human",
        },
      ];

      const counts = countEventsByType(events);

      expect(counts.GAME_INITIALIZED).toBe(1);
      expect(counts.TURN_STARTED).toBe(1);
      expect(counts.PHASE_CHANGED).toBe(1);
      expect(counts.CARD_GAINED).toBe(1);
      expect(counts.TURN_ENDED).toBe(1);
    });

    it("counts large number of events efficiently", () => {
      const events: GameEvent[] = Array.from({ length: 1000 }).map(() => ({
        type: "CARD_DRAWN",
        playerId: "human",
        card: "Copper",
      })) as GameEvent[];

      const counts = countEventsByType(events);

      expect(counts.CARD_DRAWN).toBe(1000);
    });
  });

  describe("integration scenarios", () => {
    it("projects complete game from initialization to end", () => {
      const events: GameEvent[] = [
        {
          type: "GAME_INITIALIZED",
          players: ["human", "ai"],
          kingdomCards: ["Village"],
          supply: { Province: 8 },
        },
        {
          type: "INITIAL_DECK_DEALT",
          playerId: "human",
          cards: ["Copper", "Copper", "Estate"],
        },
        {
          type: "INITIAL_DECK_DEALT",
          playerId: "ai",
          cards: ["Copper", "Copper", "Estate"],
        },
        {
          type: "INITIAL_HAND_DRAWN",
          playerId: "human",
          cards: ["Copper", "Copper"],
        },
        {
          type: "INITIAL_HAND_DRAWN",
          playerId: "ai",
          cards: ["Copper", "Copper"],
        },
        {
          type: "TURN_STARTED",
          turn: 1,
          playerId: "human",
        },
        {
          type: "PHASE_CHANGED",
          phase: "buy",
        },
        {
          type: "TURN_ENDED",
          turn: 1,
          playerId: "human",
        },
        {
          type: "GAME_ENDED",
          winnerId: "human",
          scores: { human: 10, ai: 5 },
          reason: "provinces_empty",
        },
      ];

      const state = projectState(events);

      expect(state.gameOver).toBe(true);
      expect(state.winnerId).toBe("human");
      expect(state.turn).toBe(1);
    });

    it("can use getEventsForTurn and findTurnStartIndex together", () => {
      const events: GameEvent[] = [
        {
          type: "TURN_STARTED",
          turn: 1,
          playerId: "human",
        },
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Village",
          sourceIndex: 0,
        },
        {
          type: "TURN_STARTED",
          turn: 2,
          playerId: "ai",
        },
      ];

      const turnIndex = findTurnStartIndex(events, 1);
      const turnEvents = getEventsForTurn(events, 1);

      expect(turnIndex).toBe(0);
      expect(turnEvents.length).toBe(2);
      expect(turnEvents[0]).toBe(events[0]);
    });
  });
});
