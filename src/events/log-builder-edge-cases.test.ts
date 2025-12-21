import { describe, it, expect, beforeEach } from "bun:test";
import { buildLogFromEvents } from "./log-builder";
import { resetEventCounter, generateEventId } from "./id-generator";
import type { GameEvent } from "./types";

describe("Log Builder Edge Cases", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  describe("Aggregated Card Events Edge Cases", () => {
    it("should handle aggregated card events with missing first card", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Copper",
          id: generateEventId(),
        },
        {
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Silver",
          id: generateEventId(),
        },
      ];

      const log = buildLogFromEvents(events);
      expect(log.length).toBeGreaterThan(0);
      const firstEntry = log[0];
      expect(firstEntry?.type).toBe("draw-cards");
      if (firstEntry?.type === "draw-cards") {
        expect(firstEntry.cards).toEqual(["Copper", "Silver"]);
        expect(firstEntry.count).toBe(2);
      }
    });

    it("should handle empty cardCounts in aggregation", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_DISCARDED",
          playerId: "human",
          card: "Estate",
          id: generateEventId(),
        },
      ];

      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      const firstEntry = log[0];
      if (firstEntry?.type === "discard-cards") {
        expect(firstEntry.cards).toEqual(["Estate"]);
        expect(firstEntry.count).toBe(1);
      }
    });

    it("should handle card trashed events with multiple cards", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_TRASHED",
          playerId: "human",
          card: "Copper",
          id: generateEventId(),
        },
        {
          type: "CARD_TRASHED",
          playerId: "human",
          card: "Estate",
          id: generateEventId(),
        },
      ];

      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      const entry = log[0];
      if (entry?.type === "trash-card") {
        expect(entry.cards).toEqual(["Copper", "Estate"]);
        expect(entry.count).toBe(2);
      }
    });
  });

  describe("Card Event Conversions", () => {
    it("should handle CARD_RETURNED_TO_HAND from non-inPlay zones", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_RETURNED_TO_HAND",
          playerId: "human",
          card: "Copper",
          from: "discard",
          id: generateEventId(),
        },
      ];

      const log = buildLogFromEvents(events);
      // Should not create unplay-treasure entry for non-inPlay returns
      expect(log.length).toBe(0);
    });

    it("should handle CARD_RETURNED_TO_HAND treasure from inPlay", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_RETURNED_TO_HAND",
          playerId: "human",
          card: "Copper",
          from: "inPlay",
          id: generateEventId(),
        },
      ];

      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      const entry = log[0];
      expect(entry?.type).toBe("unplay-treasure");
      if (entry?.type === "unplay-treasure") {
        expect(entry.card).toBe("Copper");
        expect(entry.coins).toBe(1);
      }
    });

    it("should handle CARD_PLAYED for non-treasure, non-action cards", () => {
      // This is an edge case that shouldn't normally happen
      const events: GameEvent[] = [
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Estate" as any,
          id: generateEventId(),
        },
      ];

      const log = buildLogFromEvents(events);
      // Should filter out invalid card plays
      expect(log.length).toBe(0);
    });
  });

  describe("Resource Modification Edge Cases", () => {
    it("should filter out zero-delta resource modifications", () => {
      const events: GameEvent[] = [
        {
          type: "TURN_STARTED",
          playerId: "human",
          turn: 1,
          id: generateEventId(),
        },
        {
          type: "ACTIONS_MODIFIED",
          delta: 0,
          id: generateEventId(),
        },
        {
          type: "BUYS_MODIFIED",
          delta: 0,
          id: generateEventId(),
        },
        {
          type: "COINS_MODIFIED",
          delta: 0,
          id: generateEventId(),
        },
      ];

      const log = buildLogFromEvents(events);
      // Only turn-start should show, zero-delta modifications filtered
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("turn-start");
    });

    it("should handle positive resource modifications", () => {
      const events: GameEvent[] = [
        {
          type: "TURN_STARTED",
          playerId: "human",
          turn: 1,
          id: generateEventId(),
        },
        {
          type: "ACTIONS_MODIFIED",
          delta: 2,
          id: generateEventId(),
        },
        {
          type: "BUYS_MODIFIED",
          delta: 1,
          id: generateEventId(),
        },
        {
          type: "COINS_MODIFIED",
          delta: 3,
          id: generateEventId(),
        },
      ];

      const log = buildLogFromEvents(events);
      expect(log.length).toBe(4);

      const actionLog = log.find(l => l.type === "get-actions");
      expect(actionLog?.type).toBe("get-actions");
      if (actionLog?.type === "get-actions") {
        expect(actionLog.count).toBe(2);
      }

      const buyLog = log.find(l => l.type === "get-buys");
      expect(buyLog?.type).toBe("get-buys");
      if (buyLog?.type === "get-buys") {
        expect(buyLog.count).toBe(1);
      }

      const coinLog = log.find(l => l.type === "get-coins");
      expect(coinLog?.type).toBe("get-coins");
      if (coinLog?.type === "get-coins") {
        expect(coinLog.count).toBe(3);
      }
    });

    it("should handle negative resource modifications", () => {
      const events: GameEvent[] = [
        {
          type: "TURN_STARTED",
          playerId: "human",
          turn: 1,
          id: generateEventId(),
        },
        {
          type: "ACTIONS_MODIFIED",
          delta: -1,
          id: generateEventId(),
        },
        {
          type: "BUYS_MODIFIED",
          delta: -1,
          id: generateEventId(),
        },
        {
          type: "COINS_MODIFIED",
          delta: -5,
          id: generateEventId(),
        },
      ];

      const log = buildLogFromEvents(events);

      const actionLog = log.find(l => l.type === "use-actions");
      expect(actionLog?.type).toBe("use-actions");
      if (actionLog?.type === "use-actions") {
        expect(actionLog.count).toBe(1);
      }

      const buyLog = log.find(l => l.type === "use-buys");
      expect(buyLog?.type).toBe("use-buys");
      if (buyLog?.type === "use-buys") {
        expect(buyLog.count).toBe(1);
      }

      const coinLog = log.find(l => l.type === "spend-coins");
      expect(coinLog?.type).toBe("spend-coins");
      if (coinLog?.type === "spend-coins") {
        expect(coinLog.count).toBe(5);
      }
    });
  });

  describe("Card Gained Event Edge Cases", () => {
    it("should handle CARD_GAINED with no causedBy as buy", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_GAINED",
          playerId: "human",
          card: "Estate",
          id: generateEventId(),
        },
      ];

      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("buy-card");
      if (log[0]?.type === "buy-card") {
        expect(log[0].card).toBe("Estate");
        expect(log[0].vp).toBe(1);
        expect(log[0].children?.length).toBe(1);
      }
    });

    it("should handle CARD_GAINED with causedBy as gain", () => {
      const causeId = generateEventId();
      const events: GameEvent[] = [
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Workshop",
          id: causeId,
        },
        {
          type: "CARD_GAINED",
          playerId: "human",
          card: "Silver",
          causedBy: causeId,
          id: generateEventId(),
        },
      ];

      const log = buildLogFromEvents(events);
      const gainLog = log
        .flatMap(l => [l, ...(l.children || [])])
        .find(l => l.type === "gain-card");
      expect(gainLog?.type).toBe("gain-card");
      if (gainLog?.type === "gain-card") {
        expect(gainLog.card).toBe("Silver");
      }
    });
  });

  describe("Buy Card Children Reordering", () => {
    it("should reorder buy-card children with gain-card last", () => {
      const events: GameEvent[] = [
        {
          type: "TURN_STARTED",
          playerId: "human",
          turn: 1,
          id: generateEventId(),
        },
        {
          type: "CARD_GAINED",
          playerId: "human",
          card: "Silver",
          id: generateEventId(),
        },
      ];

      const log = buildLogFromEvents(events);
      const buyEntry = log.find(l => l.type === "buy-card");
      if (buyEntry?.type === "buy-card" && buyEntry.children) {
        const lastChild = buyEntry.children[buyEntry.children.length - 1];
        expect(lastChild?.type).toBe("gain-card");
      }
    });
  });

  describe("Nested Causality", () => {
    it("should find visible parent through filtered events", () => {
      const rootId = generateEventId();
      const invisibleId = generateEventId();
      const childId = generateEventId();

      const events: GameEvent[] = [
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Smithy",
          id: rootId,
        },
        {
          type: "DECISION_RESOLVED",
          id: invisibleId,
          causedBy: rootId,
        },
        {
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Copper",
          id: childId,
          causedBy: invisibleId,
        },
      ];

      const log = buildLogFromEvents(events);
      // Child should be nested under visible parent (CARD_PLAYED)
      const playEntry = log.find(l => l.type === "play-action");
      expect(playEntry?.children?.length).toBeGreaterThan(0);
    });
  });

  describe("CARD_REVEALED Batching", () => {
    it("should pass through CARD_REVEALED events without batching", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_REVEALED",
          playerId: "human",
          card: "Copper",
          from: "deck",
          id: generateEventId(),
        },
        {
          type: "CARD_REVEALED",
          playerId: "human",
          card: "Silver",
          from: "deck",
          id: generateEventId(),
        },
      ];

      const log = buildLogFromEvents(events);
      // Should create separate reveal entries
      expect(log.length).toBe(2);
      expect(log[0]?.type).toBe("reveal-card");
      expect(log[1]?.type).toBe("reveal-card");
    });
  });

  describe("Game Flow Events", () => {
    it("should handle GAME_ENDED with no winnerId", () => {
      const events: GameEvent[] = [
        {
          type: "TURN_STARTED",
          playerId: "human",
          turn: 1,
          id: generateEventId(),
        },
        {
          type: "GAME_ENDED",
          scores: { human: 10, ai: 10 },
          winnerId: null,
          id: generateEventId(),
        },
      ];

      const log = buildLogFromEvents(events);
      const gameOverEntry = log.find(l => l.type === "game-over");
      expect(gameOverEntry?.type).toBe("game-over");
      if (gameOverEntry?.type === "game-over") {
        // Should use current player as fallback
        expect(gameOverEntry.winnerId).toBe("human");
      }
    });

    it("should handle PHASE_CHANGED", () => {
      const events: GameEvent[] = [
        {
          type: "TURN_STARTED",
          playerId: "human",
          turn: 1,
          id: generateEventId(),
        },
        {
          type: "PHASE_CHANGED",
          phase: "buy",
          id: generateEventId(),
        },
      ];

      const log = buildLogFromEvents(events);
      const phaseEntry = log.find(l => l.type === "phase-change");
      expect(phaseEntry?.type).toBe("phase-change");
      if (phaseEntry?.type === "phase-change") {
        expect(phaseEntry.phase).toBe("buy");
      }
    });
  });

  describe("Empty Event Sequences", () => {
    it("should handle empty event array", () => {
      const log = buildLogFromEvents([]);
      expect(log).toEqual([]);
    });

    it("should handle events with no visible log entries", () => {
      const events: GameEvent[] = [
        {
          type: "DECISION_RESOLVED",
          id: generateEventId(),
        },
        {
          type: "DECISION_REQUIRED",
          playerId: "human",
          choice: "discard",
          id: generateEventId(),
        },
      ];

      const log = buildLogFromEvents(events);
      expect(log).toEqual([]);
    });
  });
});
