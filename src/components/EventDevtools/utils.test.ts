import { describe, it, expect } from "bun:test";
import { getDisplayIndex, formatEvent } from "./utils";
import type { GameEvent } from "../../events/types";

describe("EventDevtools/utils", () => {
  describe("getDisplayIndex", () => {
    const events: GameEvent[] = [
      { id: "event-1", type: "TURN_STARTED", turn: 1, playerId: "human" },
      { id: "event-2", type: "PHASE_CHANGED", phase: "action" },
      { id: "event-3", type: "CARD_PLAYED", playerId: "human", card: "Village" },
    ];

    it("should return scrubberIndex when provided", () => {
      const index = getDisplayIndex(1, "event-3", events);
      expect(index).toBe(1);
    });

    it("should return index of selected event when scrubberIndex is null", () => {
      const index = getDisplayIndex(null, "event-2", events);
      expect(index).toBe(1);
    });

    it("should return last event index when both scrubberIndex and selectedEventId are null", () => {
      const index = getDisplayIndex(null, null, events);
      expect(index).toBe(2);
    });

    it("should return null when events array is empty", () => {
      const index = getDisplayIndex(null, null, []);
      expect(index).toBe(null);
    });

    it("should return -1 when selected event not found", () => {
      const index = getDisplayIndex(null, "nonexistent", events);
      expect(index).toBe(-1);
    });

    it("should prioritize scrubberIndex over selectedEventId", () => {
      const index = getDisplayIndex(0, "event-3", events);
      expect(index).toBe(0);
    });
  });

  describe("formatEvent", () => {
    it("should format CARD_DRAWN event", () => {
      const event: GameEvent = {
        id: "1",
        type: "CARD_DRAWN",
        playerId: "human",
        card: "Village",
      };
      expect(formatEvent(event)).toBe("human drew Village");
    });

    it("should format CARD_PLAYED event", () => {
      const event: GameEvent = {
        id: "2",
        type: "CARD_PLAYED",
        playerId: "ai",
        card: "Smithy",
      };
      expect(formatEvent(event)).toBe("ai played Smithy");
    });

    it("should format CARD_DISCARDED event", () => {
      const event: GameEvent = {
        id: "3",
        type: "CARD_DISCARDED",
        playerId: "human",
        card: "Copper",
      };
      expect(formatEvent(event)).toBe("human discarded Copper");
    });

    it("should format CARD_GAINED event", () => {
      const event: GameEvent = {
        id: "4",
        type: "CARD_GAINED",
        playerId: "ai",
        card: "Silver",
        to: "discard",
      };
      expect(formatEvent(event)).toBe("ai gained Silver to discard");
    });

    it("should format TURN_STARTED event", () => {
      const event: GameEvent = {
        id: "5",
        type: "TURN_STARTED",
        turn: 3,
        playerId: "human",
      };
      expect(formatEvent(event)).toBe("Turn 3 - human");
    });

    it("should format PHASE_CHANGED event", () => {
      const event: GameEvent = {
        id: "6",
        type: "PHASE_CHANGED",
        phase: "buy",
      };
      expect(formatEvent(event)).toBe("Phase: buy");
    });

    it("should format ACTIONS_MODIFIED event with positive delta", () => {
      const event: GameEvent = {
        id: "7",
        type: "ACTIONS_MODIFIED",
        delta: 2,
      };
      expect(formatEvent(event)).toBe("Actions +2");
    });

    it("should format ACTIONS_MODIFIED event with negative delta", () => {
      const event: GameEvent = {
        id: "8",
        type: "ACTIONS_MODIFIED",
        delta: -1,
      };
      expect(formatEvent(event)).toBe("Actions -1");
    });

    it("should format BUYS_MODIFIED event with positive delta", () => {
      const event: GameEvent = {
        id: "9",
        type: "BUYS_MODIFIED",
        delta: 1,
      };
      expect(formatEvent(event)).toBe("Buys +1");
    });

    it("should format BUYS_MODIFIED event with negative delta", () => {
      const event: GameEvent = {
        id: "10",
        type: "BUYS_MODIFIED",
        delta: -1,
      };
      expect(formatEvent(event)).toBe("Buys -1");
    });

    it("should format COINS_MODIFIED event with positive delta", () => {
      const event: GameEvent = {
        id: "11",
        type: "COINS_MODIFIED",
        delta: 3,
      };
      expect(formatEvent(event)).toBe("Coins +3");
    });

    it("should format COINS_MODIFIED event with negative delta", () => {
      const event: GameEvent = {
        id: "12",
        type: "COINS_MODIFIED",
        delta: -5,
      };
      expect(formatEvent(event)).toBe("Coins -5");
    });

    it("should format DECISION_REQUIRED event with truncated prompt", () => {
      const event: GameEvent = {
        id: "13",
        type: "DECISION_REQUIRED",
        decision: {
          type: "decision",
          playerId: "human",
          prompt:
            "This is a very long prompt that should be truncated to prevent overflow",
          cards: ["Copper"],
          min: 0,
          max: 1,
        },
      };
      expect(formatEvent(event)).toBe("Decision: This is a very long prompt tha...");
    });

    it("should format DECISION_RESOLVED event with selected cards", () => {
      const event: GameEvent = {
        id: "14",
        type: "DECISION_RESOLVED",
        choice: {
          selectedCards: ["Copper", "Estate"],
        },
      };
      expect(formatEvent(event)).toBe("Decision: Copper, Estate");
    });

    it("should format DECISION_RESOLVED event with no cards as skip", () => {
      const event: GameEvent = {
        id: "15",
        type: "DECISION_RESOLVED",
        choice: {
          selectedCards: [],
        },
      };
      expect(formatEvent(event)).toBe("Decision: (skip)");
    });

    it("should format GAME_ENDED event", () => {
      const event: GameEvent = {
        id: "16",
        type: "GAME_ENDED",
        winnerId: "human",
        scores: { human: 25, ai: 18 },
      };
      expect(formatEvent(event)).toBe("Winner: human");
    });

    it("should return event type for unknown event types", () => {
      const event = {
        id: "17",
        type: "UNKNOWN_EVENT",
      } as any;
      expect(formatEvent(event)).toBe("UNKNOWN_EVENT");
    });

    it("should format delta with +0 for zero delta", () => {
      const event: GameEvent = {
        id: "18",
        type: "ACTIONS_MODIFIED",
        delta: 0,
      };
      expect(formatEvent(event)).toBe("Actions +0");
    });
  });
});
