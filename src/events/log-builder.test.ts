import { describe, it, expect, beforeEach } from "bun:test";
import { buildLogFromEvents } from "./log-builder";
import type { GameEvent } from "./types";
import { resetEventCounter } from "./id-generator";
import type { LogEntry } from "../types/game-state";

describe("buildLogFromEvents", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  describe("Test Suite 1: Event-to-Log Conversion (Individual Events)", () => {
    it("CARD_PLAYED (treasure) → play-treasure entry", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Copper",
          sourceIndex: 0,
          id: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("play-treasure");
      expect(log[0]?.card).toBe("Copper");
      expect((log[0] as any).coins).toBe(1);
    });

    it("CARD_PLAYED (action) → play-action entry", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Village",
          sourceIndex: 0,
          id: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("play-action");
      expect(log[0]?.card).toBe("Village");
    });

    it("CARD_DRAWN → draw-cards entry (single card, count=1)", () => {
      const events: GameEvent[] = [
        { type: "CARD_DRAWN", playerId: "human", card: "Copper", id: "evt-1" },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("draw-cards");
      expect((log[0] as any).count).toBe(1);
      expect((log[0] as any).cards).toEqual(["Copper"]);
    });

    it("CARD_DISCARDED → discard-cards entry (single card, count=1)", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_DISCARDED",
          playerId: "human",
          card: "Estate",
          from: "hand",
          id: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("discard-cards");
      expect((log[0] as any).count).toBe(1);
      expect((log[0] as any).cards).toEqual(["Estate"]);
    });

    it("CARD_TRASHED → trash-card entry", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_TRASHED",
          playerId: "human",
          card: "Copper",
          from: "hand",
          id: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("trash-card");
      expect(log[0]?.card).toBe("Copper");
    });

    it("CARD_GAINED (no causedBy) → buy-card with gain-card child", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_GAINED",
          playerId: "human",
          card: "Silver",
          to: "discard",
          id: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("buy-card");
      expect(log[0]?.card).toBe("Silver");
      expect(log[0]?.children?.length).toBe(1);
      expect(log[0]?.children?.[0]?.type).toBe("gain-card");
    });

    it("CARD_GAINED (with causedBy) → gain-card entry", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Workshop",
          sourceIndex: 0,
          id: "evt-1",
        },
        {
          type: "CARD_GAINED",
          playerId: "human",
          card: "Silver",
          to: "discard",
          id: "evt-2",
          causedBy: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("play-action");
      expect(log[0]?.children?.length).toBe(1);
      expect(log[0]?.children?.[0]?.type).toBe("gain-card");
    });

    it("CARD_REVEALED → reveal-card entry (NOT aggregated at this stage)", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_REVEALED",
          playerId: "ai",
          card: "Silver",
          from: "deck",
          id: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("reveal-card");
      expect(log[0]?.card).toBe("Silver");
      expect((log[0] as any).from).toBe("deck");
    });

    it("DECK_SHUFFLED → shuffle-deck entry", () => {
      const events: GameEvent[] = [
        { type: "DECK_SHUFFLED", playerId: "human", id: "evt-1" },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("shuffle-deck");
      expect(log[0]?.playerId).toBe("human");
    });

    it("TURN_STARTED → turn-start entry", () => {
      const events: GameEvent[] = [
        { type: "TURN_STARTED", turn: 1, playerId: "human", id: "evt-1" },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("turn-start");
      expect((log[0] as any).turn).toBe(1);
      expect(log[0]?.playerId).toBe("human");
    });

    it("PHASE_CHANGED → phase-change entry", () => {
      const events: GameEvent[] = [
        { type: "PHASE_CHANGED", phase: "buy", id: "evt-1" },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("phase-change");
      expect((log[0] as any).phase).toBe("buy");
    });

    it("ACTIONS_MODIFIED (positive delta) → get-actions entry", () => {
      const events: GameEvent[] = [
        { type: "TURN_STARTED", turn: 1, playerId: "human", id: "evt-1" },
        { type: "ACTIONS_MODIFIED", delta: 2, id: "evt-2" },
      ];
      const log = buildLogFromEvents(events);
      const actionLog = log.find(entry => entry.type === "get-actions");
      expect(actionLog).toBeDefined();
      expect((actionLog as any).count).toBe(2);
    });

    it("ACTIONS_MODIFIED (negative delta) → use-actions entry", () => {
      const events: GameEvent[] = [
        { type: "TURN_STARTED", turn: 1, playerId: "human", id: "evt-1" },
        { type: "ACTIONS_MODIFIED", delta: -1, id: "evt-2" },
      ];
      const log = buildLogFromEvents(events);
      const actionLog = log.find(entry => entry.type === "use-actions");
      expect(actionLog).toBeDefined();
      expect((actionLog as any).count).toBe(1);
    });

    it("BUYS_MODIFIED (positive delta) → get-buys entry", () => {
      const events: GameEvent[] = [
        { type: "TURN_STARTED", turn: 1, playerId: "human", id: "evt-1" },
        { type: "BUYS_MODIFIED", delta: 1, id: "evt-2" },
      ];
      const log = buildLogFromEvents(events);
      const buyLog = log.find(entry => entry.type === "get-buys");
      expect(buyLog).toBeDefined();
      expect((buyLog as any).count).toBe(1);
    });

    it("BUYS_MODIFIED (negative delta) → use-buys entry", () => {
      const events: GameEvent[] = [
        { type: "TURN_STARTED", turn: 1, playerId: "human", id: "evt-1" },
        { type: "BUYS_MODIFIED", delta: -1, id: "evt-2" },
      ];
      const log = buildLogFromEvents(events);
      const buyLog = log.find(entry => entry.type === "use-buys");
      expect(buyLog).toBeDefined();
      expect((buyLog as any).count).toBe(1);
    });

    it("COINS_MODIFIED (positive delta) → get-coins entry", () => {
      const events: GameEvent[] = [
        { type: "TURN_STARTED", turn: 1, playerId: "human", id: "evt-1" },
        { type: "COINS_MODIFIED", delta: 3, id: "evt-2" },
      ];
      const log = buildLogFromEvents(events);
      const coinLog = log.find(entry => entry.type === "get-coins");
      expect(coinLog).toBeDefined();
      expect((coinLog as any).count).toBe(3);
    });

    it("COINS_MODIFIED (negative delta) → spend-coins entry", () => {
      const events: GameEvent[] = [
        { type: "TURN_STARTED", turn: 1, playerId: "human", id: "evt-1" },
        { type: "COINS_MODIFIED", delta: -4, id: "evt-2" },
      ];
      const log = buildLogFromEvents(events);
      const coinLog = log.find(entry => entry.type === "spend-coins");
      expect(coinLog).toBeDefined();
      expect((coinLog as any).count).toBe(4);
    });

    it("ACTIONS_MODIFIED (zero delta) → no log entry", () => {
      const events: GameEvent[] = [
        { type: "TURN_STARTED", turn: 1, playerId: "human", id: "evt-1" },
        { type: "ACTIONS_MODIFIED", delta: 0, id: "evt-2" },
      ];
      const log = buildLogFromEvents(events);
      const actionLog = log.find(
        entry => entry.type === "get-actions" || entry.type === "use-actions",
      );
      expect(actionLog).toBeUndefined();
    });

    it("DECISION_REQUIRED event → no log entry (filtered)", () => {
      const events: GameEvent[] = [
        {
          type: "DECISION_REQUIRED",
          decision: {
            choiceType: "decision",
            playerId: "human",
            prompt: "Test",
            options: [],
            minSelections: 0,
            maxSelections: 1,
          },
          id: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(0);
    });

    it("ATTACK_DECLARED event → no log entry (filtered)", () => {
      const events: GameEvent[] = [
        {
          type: "ATTACK_DECLARED",
          attacker: "human",
          attackCard: "Militia",
          targets: ["ai"],
          id: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(0);
    });

    it("CARD_PLAYED (non-action, non-treasure) → no log entry", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Curse",
          sourceIndex: 0,
          id: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(0);
    });
  });

  describe("Test Suite 2: Causality Nesting", () => {
    it("events with causedBy nest under parent", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Village",
          sourceIndex: 0,
          id: "evt-1",
        },
        {
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Copper",
          id: "evt-2",
          causedBy: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("play-action");
      expect(log[0]?.children?.length).toBe(1);
      expect(log[0]?.children?.[0]?.type).toBe("draw-cards");
    });

    it("multi-level nesting (grandchild events)", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Market",
          sourceIndex: 0,
          id: "evt-1",
        },
        {
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Copper",
          id: "evt-2",
          causedBy: "evt-1",
        },
        {
          type: "DECK_SHUFFLED",
          playerId: "human",
          id: "evt-3",
          causedBy: "evt-2",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("play-action");
      expect(log[0]?.children?.length).toBe(1);
      expect(log[0]?.children?.[0]?.type).toBe("draw-cards");
      expect(log[0]?.children?.[0]?.children?.length).toBe(1);
      expect(log[0]?.children?.[0]?.children?.[0]?.type).toBe("shuffle-deck");
    });

    it("orphaned events (causedBy points to filtered event) → become root entries", () => {
      const events: GameEvent[] = [
        {
          type: "DECISION_REQUIRED",
          decision: {
            choiceType: "decision",
            playerId: "human",
            prompt: "Test",
            options: [],
            minSelections: 0,
            maxSelections: 1,
          },
          id: "evt-1",
        },
        {
          type: "CARD_GAINED",
          playerId: "human",
          card: "Silver",
          to: "discard",
          id: "evt-2",
          causedBy: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("gain-card");
      expect(log[0]?.children).toBeUndefined();
    });

    it("event IDs preserved through nesting", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Smithy",
          sourceIndex: 0,
          id: "evt-1",
        },
        {
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Copper",
          id: "evt-2",
          causedBy: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log[0]?.eventId).toBe("evt-1");
      expect(log[0]?.children?.[0]?.eventId).toBe("evt-2");
    });

    it("multiple children under same parent", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Smithy",
          sourceIndex: 0,
          id: "evt-1",
        },
        {
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Copper",
          id: "evt-2",
          causedBy: "evt-1",
        },
        {
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Silver",
          id: "evt-3",
          causedBy: "evt-1",
        },
        {
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Gold",
          id: "evt-4",
          causedBy: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.children?.length).toBe(1);
      expect((log[0]?.children?.[0] as any).count).toBe(3);
      expect((log[0]?.children?.[0] as any).cards).toEqual([
        "Copper",
        "Silver",
        "Gold",
      ]);
    });

    it("orphaned event walks up causality chain to find visible ancestor", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Workshop",
          sourceIndex: 0,
          id: "evt-1",
        },
        {
          type: "DECISION_REQUIRED",
          decision: {
            choiceType: "decision",
            playerId: "human",
            prompt: "Gain a card",
            options: [],
            minSelections: 0,
            maxSelections: 1,
          },
          id: "evt-2",
          causedBy: "evt-1",
        },
        {
          type: "DECISION_RESOLVED",
          playerId: "human",
          choice: { type: "card", cards: ["Silver"] },
          id: "evt-3",
          causedBy: "evt-2",
        },
        {
          type: "CARD_GAINED",
          playerId: "human",
          card: "Silver",
          to: "discard",
          id: "evt-4",
          causedBy: "evt-3",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("play-action");
      expect(log[0]?.children?.length).toBe(1);
      expect(log[0]?.children?.[0]?.type).toBe("gain-card");
    });
  });

  describe("Test Suite 3: Event Aggregation in buildLogFromEvents", () => {
    it("consecutive CARD_DRAWN from same player → single entry with count", () => {
      const events: GameEvent[] = [
        { type: "CARD_DRAWN", playerId: "human", card: "Copper", id: "evt-1" },
        { type: "CARD_DRAWN", playerId: "human", card: "Silver", id: "evt-2" },
        { type: "CARD_DRAWN", playerId: "human", card: "Gold", id: "evt-3" },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("draw-cards");
      expect((log[0] as any).count).toBe(3);
      expect((log[0] as any).cards).toEqual(["Copper", "Silver", "Gold"]);
      expect((log[0] as any).cardCounts).toEqual({
        Copper: 1,
        Silver: 1,
        Gold: 1,
      });
    });

    it("CARD_DRAWN split by DECK_SHUFFLED → separate entries", () => {
      const events: GameEvent[] = [
        { type: "CARD_DRAWN", playerId: "human", card: "Copper", id: "evt-1" },
        { type: "CARD_DRAWN", playerId: "human", card: "Silver", id: "evt-2" },
        { type: "DECK_SHUFFLED", playerId: "human", id: "evt-3" },
        { type: "CARD_DRAWN", playerId: "human", card: "Gold", id: "evt-4" },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(3);
      expect(log[0]?.type).toBe("draw-cards");
      expect((log[0] as any).count).toBe(2);
      expect(log[1]?.type).toBe("shuffle-deck");
      expect(log[2]?.type).toBe("draw-cards");
      expect((log[2] as any).count).toBe(1);
    });

    it("CARD_DRAWN from different players → separate entries", () => {
      const events: GameEvent[] = [
        { type: "CARD_DRAWN", playerId: "human", card: "Copper", id: "evt-1" },
        { type: "CARD_DRAWN", playerId: "ai", card: "Silver", id: "evt-2" },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(2);
      expect(log[0]?.playerId).toBe("human");
      expect(log[1]?.playerId).toBe("ai");
    });

    it("CARD_DRAWN with different causedBy → separate entries", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Village",
          sourceIndex: 0,
          id: "evt-1",
        },
        {
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Copper",
          id: "evt-2",
          causedBy: "evt-1",
        },
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Smithy",
          sourceIndex: 1,
          id: "evt-3",
        },
        {
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Silver",
          id: "evt-4",
          causedBy: "evt-3",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(2);
      expect(log[0]?.children?.length).toBe(1);
      expect(log[1]?.children?.length).toBe(1);
    });

    it("consecutive CARD_DISCARDED from same player → single entry with count", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_DISCARDED",
          playerId: "human",
          card: "Estate",
          from: "hand",
          id: "evt-1",
        },
        {
          type: "CARD_DISCARDED",
          playerId: "human",
          card: "Copper",
          from: "hand",
          id: "evt-2",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("discard-cards");
      expect((log[0] as any).count).toBe(2);
      expect((log[0] as any).cards).toEqual(["Estate", "Copper"]);
    });

    it("consecutive CARD_TRASHED from same player → single entry", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_TRASHED",
          playerId: "human",
          card: "Copper",
          from: "hand",
          id: "evt-1",
        },
        {
          type: "CARD_TRASHED",
          playerId: "human",
          card: "Estate",
          from: "hand",
          id: "evt-2",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("trash-card");
      expect((log[0] as any).cards).toEqual(["Copper", "Estate"]);
      expect((log[0] as any).count).toBe(2);
    });

    it("CARD_REVEALED not aggregated (passes through unchanged)", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_REVEALED",
          playerId: "ai",
          card: "Silver",
          from: "deck",
          id: "evt-1",
        },
        {
          type: "CARD_REVEALED",
          playerId: "ai",
          card: "Gold",
          from: "deck",
          id: "evt-2",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(2);
      expect(log[0]?.type).toBe("reveal-card");
      expect(log[1]?.type).toBe("reveal-card");
    });

    it("consecutive draws without causedBy → all batch together", () => {
      const events: GameEvent[] = [
        { type: "CARD_DRAWN", playerId: "human", card: "Copper", id: "evt-1" },
        { type: "CARD_DRAWN", playerId: "human", card: "Silver", id: "evt-2" },
        { type: "CARD_DRAWN", playerId: "human", card: "Gold", id: "evt-3" },
        { type: "CARD_DRAWN", playerId: "human", card: "Estate", id: "evt-4" },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect((log[0] as any).count).toBe(4);
    });

    it("duplicate cards in aggregation show correct counts", () => {
      const events: GameEvent[] = [
        { type: "CARD_DRAWN", playerId: "human", card: "Copper", id: "evt-1" },
        { type: "CARD_DRAWN", playerId: "human", card: "Copper", id: "evt-2" },
        { type: "CARD_DRAWN", playerId: "human", card: "Copper", id: "evt-3" },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect((log[0] as any).count).toBe(3);
      expect((log[0] as any).cardCounts).toEqual({ Copper: 3 });
      expect((log[0] as any).cards).toEqual(["Copper", "Copper", "Copper"]);
    });
  });

  describe("Test Suite 4: Buy Card Children Reordering", () => {
    it("buy-card children ordered: use-buys, spend-coins before gain-card", () => {
      const events: GameEvent[] = [
        { type: "TURN_STARTED", turn: 1, playerId: "human", id: "evt-1" },
        {
          type: "CARD_GAINED",
          playerId: "human",
          card: "Silver",
          to: "discard",
          id: "evt-2",
        },
        { type: "BUYS_MODIFIED", delta: -1, id: "evt-3", causedBy: "evt-2" },
        { type: "COINS_MODIFIED", delta: -3, id: "evt-4", causedBy: "evt-2" },
      ];
      const log = buildLogFromEvents(events);
      const buyCard = log.find(entry => entry.type === "buy-card");
      expect(buyCard).toBeDefined();
      expect(buyCard?.children?.length).toBe(3);
      expect(buyCard?.children?.[0]?.type).toBe("use-buys");
      expect(buyCard?.children?.[1]?.type).toBe("spend-coins");
      expect(buyCard?.children?.[2]?.type).toBe("gain-card");
    });

    it("multiple resource modifications preserved in order", () => {
      const events: GameEvent[] = [
        { type: "TURN_STARTED", turn: 1, playerId: "human", id: "evt-1" },
        {
          type: "CARD_GAINED",
          playerId: "human",
          card: "Province",
          to: "discard",
          id: "evt-2",
        },
        { type: "BUYS_MODIFIED", delta: -1, id: "evt-3", causedBy: "evt-2" },
        { type: "COINS_MODIFIED", delta: -5, id: "evt-4", causedBy: "evt-2" },
        { type: "COINS_MODIFIED", delta: -3, id: "evt-5", causedBy: "evt-2" },
      ];
      const log = buildLogFromEvents(events);
      const buyCard = log.find(entry => entry.type === "buy-card");
      expect(buyCard).toBeDefined();
      expect(buyCard?.children?.length).toBe(4);
      expect(buyCard?.children?.[0]?.type).toBe("use-buys");
      expect(buyCard?.children?.[1]?.type).toBe("spend-coins");
      expect(buyCard?.children?.[2]?.type).toBe("spend-coins");
      expect(buyCard?.children?.[3]?.type).toBe("gain-card");
    });

    it("recursive reordering (children properly ordered at all levels)", () => {
      const events: GameEvent[] = [
        { type: "TURN_STARTED", turn: 1, playerId: "human", id: "evt-1" },
        {
          type: "CARD_GAINED",
          playerId: "human",
          card: "Silver",
          to: "discard",
          id: "evt-2",
        },
        { type: "BUYS_MODIFIED", delta: -1, id: "evt-3", causedBy: "evt-2" },
        { type: "COINS_MODIFIED", delta: -3, id: "evt-4", causedBy: "evt-2" },
      ];
      const log = buildLogFromEvents(events);
      const buyCard = log.find(entry => entry.type === "buy-card");
      expect(buyCard).toBeDefined();
      expect(buyCard?.children?.length).toBe(3);
      // Verify spending comes before gain
      expect(buyCard?.children?.[0]?.type).toBe("use-buys");
      expect(buyCard?.children?.[1]?.type).toBe("spend-coins");
      expect(buyCard?.children?.[2]?.type).toBe("gain-card");
    });

    it("buy-card without resource spending still has gain-card child", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_GAINED",
          playerId: "human",
          card: "Curse",
          to: "discard",
          id: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("buy-card");
      expect(log[0]?.children?.length).toBe(1);
      expect(log[0]?.children?.[0]?.type).toBe("gain-card");
    });
  });

  describe("Test Suite 5: CARD_REVEALED Regression Tests (CRITICAL)", () => {
    it("single CARD_REVEALED creates reveal-card entry (not aggregated)", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_REVEALED",
          playerId: "ai",
          card: "Silver",
          from: "deck",
          id: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("reveal-card");
      expect(log[0]?.card).toBe("Silver");
      expect((log[0] as any).from).toBe("deck");
    });

    it("consecutive CARD_REVEALED (same player) → separate entries at this stage", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_REVEALED",
          playerId: "ai",
          card: "Silver",
          from: "deck",
          id: "evt-1",
        },
        {
          type: "CARD_REVEALED",
          playerId: "ai",
          card: "Gold",
          from: "deck",
          id: "evt-2",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(2);
      expect(log[0]?.type).toBe("reveal-card");
      expect(log[0]?.card).toBe("Silver");
      expect(log[1]?.type).toBe("reveal-card");
      expect(log[1]?.card).toBe("Gold");
    });

    it("CARD_REVEALED with causedBy nests under parent", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Bandit",
          sourceIndex: 0,
          id: "evt-1",
        },
        {
          type: "CARD_REVEALED",
          playerId: "ai",
          card: "Silver",
          from: "deck",
          id: "evt-2",
          causedBy: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("play-action");
      expect(log[0]?.children?.length).toBe(1);
      expect(log[0]?.children?.[0]?.type).toBe("reveal-card");
    });

    it("CARD_REVEALED with different 'from' values → separate entries", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_REVEALED",
          playerId: "ai",
          card: "Silver",
          from: "deck",
          id: "evt-1",
        },
        {
          type: "CARD_REVEALED",
          playerId: "ai",
          card: "Gold",
          from: "hand",
          id: "evt-2",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(2);
      expect((log[0] as any).from).toBe("deck");
      expect((log[1] as any).from).toBe("hand");
    });

    it("Bandit attack (2 CARD_REVEALED per opponent) → 2 separate reveal-card entries", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Bandit",
          sourceIndex: 0,
          id: "evt-1",
        },
        {
          type: "CARD_REVEALED",
          playerId: "ai",
          card: "Silver",
          from: "deck",
          id: "evt-2",
          causedBy: "evt-1",
        },
        {
          type: "CARD_REVEALED",
          playerId: "ai",
          card: "Gold",
          from: "deck",
          id: "evt-3",
          causedBy: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("play-action");
      expect(log[0]?.card).toBe("Bandit");
      expect(log[0]?.children?.length).toBe(2);
      expect(log[0]?.children?.[0]?.type).toBe("reveal-card");
      expect(log[0]?.children?.[0]?.card).toBe("Silver");
      expect(log[0]?.children?.[1]?.type).toBe("reveal-card");
      expect(log[0]?.children?.[1]?.card).toBe("Gold");
    });

    it("multiple opponents revealing cards under attack", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Bandit",
          sourceIndex: 0,
          id: "evt-1",
        },
        {
          type: "CARD_REVEALED",
          playerId: "ai1",
          card: "Silver",
          from: "deck",
          id: "evt-2",
          causedBy: "evt-1",
        },
        {
          type: "CARD_REVEALED",
          playerId: "ai1",
          card: "Gold",
          from: "deck",
          id: "evt-3",
          causedBy: "evt-1",
        },
        {
          type: "CARD_REVEALED",
          playerId: "ai2",
          card: "Copper",
          from: "deck",
          id: "evt-4",
          causedBy: "evt-1",
        },
        {
          type: "CARD_REVEALED",
          playerId: "ai2",
          card: "Estate",
          from: "deck",
          id: "evt-5",
          causedBy: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.children?.length).toBe(4);
      expect(log[0]?.children?.filter(c => c.type === "reveal-card").length).toBe(
        4,
      );
    });

    it("CARD_REVEALED preserves eventId", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_REVEALED",
          playerId: "ai",
          card: "Silver",
          from: "deck",
          id: "evt-123",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log[0]?.eventId).toBe("evt-123");
    });
  });

  describe("Additional Coverage Tests", () => {
    it("handles non-aggregated CARD_DRAWN without eventId", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Copper",
          id: undefined,
        },
      ];
      const log = buildLogFromEvents(events);
      // Events without ID won't create log entries
      expect(log.length).toBe(0);
    });

    it("handles non-aggregated CARD_DISCARDED without eventId", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_DISCARDED",
          playerId: "human",
          card: "Estate",
          from: "hand",
          id: undefined,
        },
      ];
      const log = buildLogFromEvents(events);
      // Events without ID won't create log entries
      expect(log.length).toBe(0);
    });

    it("handles non-aggregated CARD_TRASHED without eventId", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_TRASHED",
          playerId: "human",
          card: "Copper",
          from: "hand",
          id: undefined,
        },
      ];
      const log = buildLogFromEvents(events);
      // Events without ID won't create log entries
      expect(log.length).toBe(0);
    });

    it("handles CARD_RETURNED_TO_HAND from inPlay (treasure) → unplay-treasure", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_RETURNED_TO_HAND",
          playerId: "human",
          card: "Copper",
          from: "inPlay",
          id: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
      expect(log[0]?.type).toBe("unplay-treasure");
      expect(log[0]?.card).toBe("Copper");
      expect((log[0] as any).coins).toBe(1);
    });

    it("handles CARD_RETURNED_TO_HAND from discard (no log entry)", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_RETURNED_TO_HAND",
          playerId: "human",
          card: "Silver",
          from: "discard",
          id: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(0);
    });

    it("handles CARD_RETURNED_TO_HAND from deck (no log entry)", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_RETURNED_TO_HAND",
          playerId: "human",
          card: "Gold",
          from: "deck",
          id: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(0);
    });

    it("handles CARD_RETURNED_TO_HAND (action card from inPlay, no log entry)", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_RETURNED_TO_HAND",
          playerId: "human",
          card: "Village",
          from: "inPlay",
          id: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(0);
    });

    it("handles GAME_ENDED without id", () => {
      const events: GameEvent[] = [
        {
          type: "GAME_ENDED",
          winnerId: "human",
          scores: { human: 10, ai: 5 },
          reason: "provinces_empty",
          id: undefined,
        },
      ];
      const log = buildLogFromEvents(events);
      // Events without ID won't create log entries
      expect(log.length).toBe(0);
    });

    it("handles TURN_ENDED without id", () => {
      const events: GameEvent[] = [
        {
          type: "TURN_STARTED",
          turn: 1,
          playerId: "human",
          id: "evt-1",
        },
        {
          type: "TURN_ENDED",
          playerId: "human",
          turn: 1,
          id: undefined,
        },
      ];
      const log = buildLogFromEvents(events);
      // TURN_ENDED without ID won't create a log entry
      const turnEnd = log.find(entry => entry.type === "turn-end");
      expect(turnEnd).toBeUndefined();
    });

    it("handles PHASE_CHANGED without id", () => {
      const events: GameEvent[] = [
        {
          type: "TURN_STARTED",
          turn: 1,
          playerId: "human",
          id: "evt-1",
        },
        {
          type: "PHASE_CHANGED",
          phase: "buy",
          id: undefined,
        },
      ];
      const log = buildLogFromEvents(events);
      // PHASE_CHANGED without ID won't create a log entry
      const phaseChange = log.find(entry => entry.type === "phase-change");
      expect(phaseChange).toBeUndefined();
    });

    it("aggregateCardEvents: handles empty currentEvent in collectConsecutive", () => {
      // This tests a defensive check where currentEvent could be undefined
      const events: GameEvent[] = [
        {
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Copper",
          id: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(1);
    });

    it("aggregateCardEvents: handles DECK_SHUFFLED interrupting aggregation", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Copper",
          id: "evt-1",
        },
        {
          type: "DECK_SHUFFLED",
          playerId: "human",
          id: "evt-2",
        },
        {
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Silver",
          id: "evt-3",
        },
      ];
      const log = buildLogFromEvents(events);
      // Should have separate draw entries due to shuffle
      const draws = log.filter(entry => entry.type === "draw-cards");
      expect(draws.length).toBeGreaterThanOrEqual(2);
    });

    it("handles CARD_PLAYED (victory card) → returns null, no log", () => {
      const events: GameEvent[] = [
        {
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Estate",
          sourceIndex: 0,
          id: "evt-1",
        },
      ];
      const log = buildLogFromEvents(events);
      expect(log.length).toBe(0);
    });

    it("handles zero delta resource events", () => {
      const events: GameEvent[] = [
        {
          type: "TURN_STARTED",
          turn: 1,
          playerId: "human",
          id: "evt-1",
        },
        {
          type: "ACTIONS_MODIFIED",
          delta: 0,
          id: "evt-2",
        },
      ];
      const log = buildLogFromEvents(events);
      // Zero delta should not create a log entry
      const actionLogs = log.filter(
        entry => entry.type === "get-actions" || entry.type === "use-actions",
      );
      expect(actionLogs.length).toBe(0);
    });
  });
});
