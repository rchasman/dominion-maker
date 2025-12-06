import { describe, it, expect, beforeEach } from "bun:test";
import { generateEventId, resetEventCounter } from "./id-generator";
import { getCausalChain, removeEventChain, isRootCauseEvent } from "./types";
import type { GameEvent } from "./types";

describe("Causality Tracking", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should identify root cause events", () => {
    const cardPlayedEvent: GameEvent = {
      type: "CARD_PLAYED",
      player: "human",
      card: "Village",
      id: "evt-1",
    };

    const coinEvent: GameEvent = {
      type: "COINS_MODIFIED",
      delta: 2,
      id: "evt-2",
      causedBy: "evt-1",
    };

    expect(isRootCauseEvent(cardPlayedEvent)).toBe(true);
    expect(isRootCauseEvent(coinEvent)).toBe(false);
  });

  it("should find all events in a causal chain", () => {
    const events: GameEvent[] = [
      {
        type: "CARD_PLAYED",
        player: "human",
        card: "Market",
        id: "evt-1",
      },
      {
        type: "ACTIONS_MODIFIED",
        delta: -1,
        id: "evt-2",
        causedBy: "evt-1",
      },
      {
        type: "CARDS_DRAWN",
        player: "human",
        cards: ["Estate"],
        id: "evt-3",
        causedBy: "evt-1",
      },
      {
        type: "ACTIONS_MODIFIED",
        delta: 1,
        id: "evt-4",
        causedBy: "evt-1",
      },
      {
        type: "BUYS_MODIFIED",
        delta: 1,
        id: "evt-5",
        causedBy: "evt-1",
      },
      {
        type: "COINS_MODIFIED",
        delta: 1,
        id: "evt-6",
        causedBy: "evt-1",
      },
    ];

    const chain = getCausalChain("evt-1", events);

    expect(chain.size).toBe(6);
    expect(chain.has("evt-1")).toBe(true);
    expect(chain.has("evt-2")).toBe(true);
    expect(chain.has("evt-3")).toBe(true);
    expect(chain.has("evt-4")).toBe(true);
    expect(chain.has("evt-5")).toBe(true);
    expect(chain.has("evt-6")).toBe(true);
  });

  it("should remove entire causal chain atomically", () => {
    const events: GameEvent[] = [
      {
        type: "CARD_PLAYED",
        player: "human",
        card: "Festival",
        id: "evt-1",
      },
      {
        type: "ACTIONS_MODIFIED",
        delta: -1,
        id: "evt-2",
        causedBy: "evt-1",
      },
      {
        type: "COINS_MODIFIED",
        delta: 2,
        id: "evt-3",
        causedBy: "evt-1",
      },
      {
        type: "CARD_PLAYED",
        player: "human",
        card: "Market",
        id: "evt-4",
      },
      {
        type: "ACTIONS_MODIFIED",
        delta: -1,
        id: "evt-5",
        causedBy: "evt-4",
      },
      {
        type: "COINS_MODIFIED",
        delta: 1,
        id: "evt-6",
        causedBy: "evt-4",
      },
    ];

    // Undo playing Market (evt-4)
    const afterUndo = removeEventChain("evt-4", events);

    // Should remove Market and its effects, but keep Festival chain
    expect(afterUndo.length).toBe(3);
    expect(afterUndo[0].id).toBe("evt-1");
    expect(afterUndo[1].id).toBe("evt-2");
    expect(afterUndo[2].id).toBe("evt-3");
  });

  it("should handle nested causality chains", () => {
    const events: GameEvent[] = [
      {
        type: "CARD_PLAYED",
        player: "human",
        card: "Village",
        id: "evt-1",
      },
      {
        type: "ACTIONS_MODIFIED",
        delta: -1,
        id: "evt-2",
        causedBy: "evt-1",
      },
      {
        type: "CARDS_DRAWN",
        player: "human",
        cards: ["Copper"],
        id: "evt-3",
        causedBy: "evt-1",
      },
      // Throne Room that doubles Village
      {
        type: "CARD_PLAYED",
        player: "human",
        card: "Village",
        id: "evt-4",
        causedBy: "evt-1", // Second play caused by Throne Room
      },
      {
        type: "CARDS_DRAWN",
        player: "human",
        cards: ["Estate"],
        id: "evt-5",
        causedBy: "evt-4",
      },
    ];

    // Remove the root - should remove nested chains too
    const chain = getCausalChain("evt-1", events);

    expect(chain.size).toBe(5); // All events linked
    expect(chain.has("evt-4")).toBe(true); // Nested event
    expect(chain.has("evt-5")).toBe(true); // Deeply nested
  });

  it("demonstrates no intermediate states after implementing causality", () => {
    // This is the BEFORE scenario from your question:
    // Event -2: COINS_MODIFIED
    // Event -1: CARD_PLAYED
    // Event  0: COINS_MODIFIED  ← BAD: Can't undo to here
    // Event  1: CARD_PLAYED
    // Event  2: COINS_MODIFIED

    // AFTER: With causality tracking
    const events: GameEvent[] = [
      {
        type: "CARD_PLAYED",
        player: "human",
        card: "Copper",
        id: "evt-1", // ROOT
      },
      {
        type: "COINS_MODIFIED",
        delta: 1,
        id: "evt-2",
        causedBy: "evt-1", // Effect
      },
      {
        type: "CARD_PLAYED",
        player: "human",
        card: "Silver",
        id: "evt-3", // ROOT
      },
      {
        type: "COINS_MODIFIED",
        delta: 2,
        id: "evt-4",
        causedBy: "evt-3", // Effect
      },
      {
        type: "CARD_PLAYED",
        player: "human",
        card: "Gold",
        id: "evt-5", // ROOT
      },
      {
        type: "COINS_MODIFIED",
        delta: 3,
        id: "evt-6",
        causedBy: "evt-5", // Effect
      },
    ];

    // Valid undo points are ONLY root causes
    const validUndoPoints = events.filter(isRootCauseEvent);

    expect(validUndoPoints.length).toBe(3);
    expect(validUndoPoints.map(e => e.id)).toEqual(["evt-1", "evt-3", "evt-5"]);

    // Undoing to evt-3 (Silver) removes Gold chain
    const afterUndo = removeEventChain("evt-5", events);

    // Should have: Copper + effect, Silver + effect
    expect(afterUndo.length).toBe(4);
    expect(afterUndo.map(e => e.type)).toEqual([
      "CARD_PLAYED",
      "COINS_MODIFIED",
      "CARD_PLAYED",
      "COINS_MODIFIED",
    ]);

    // CRITICAL: Cannot undo to evt-2 or evt-4 (the COINS_MODIFIED events)
    // because they're not root causes - they're effects!
    const evt2IsUndoable = isRootCauseEvent(events[1]);
    const evt4IsUndoable = isRootCauseEvent(events[3]);

    expect(evt2IsUndoable).toBe(false);
    expect(evt4IsUndoable).toBe(false);

    // This means NO INTERMEDIATE STATES are possible!
  });

  it("should generate unique event IDs", () => {
    const id1 = generateEventId();
    const id2 = generateEventId();
    const id3 = generateEventId();

    expect(id1).toBe("evt-1");
    expect(id2).toBe("evt-2");
    expect(id3).toBe("evt-3");
  });
});
