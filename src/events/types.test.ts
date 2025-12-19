import { describe, it, expect, beforeEach } from "bun:test";
import {
  isCardMovementEvent,
  isResourceEvent,
  isRootCauseEvent,
  getCausalChain,
  removeEventChain,
} from "./types";
import { resetEventCounter } from "./id-generator";
import type { GameEvent } from "./types";

describe("types - event guards", () => {
  describe("isCardMovementEvent", () => {
    it("returns true for CARD_DRAWN", () => {
      const event: GameEvent = {
        type: "CARD_DRAWN",
        playerId: "human",
        card: "Copper",
      };

      expect(isCardMovementEvent(event)).toBe(true);
    });

    it("returns true for CARD_PLAYED", () => {
      const event: GameEvent = {
        type: "CARD_PLAYED",
        playerId: "human",
        card: "Village",
        sourceIndex: 0,
      };

      expect(isCardMovementEvent(event)).toBe(true);
    });

    it("returns true for CARD_DISCARDED", () => {
      const event: GameEvent = {
        type: "CARD_DISCARDED",
        playerId: "human",
        card: "Copper",
        from: "hand",
      };

      expect(isCardMovementEvent(event)).toBe(true);
    });

    it("returns true for CARD_TRASHED", () => {
      const event: GameEvent = {
        type: "CARD_TRASHED",
        playerId: "human",
        card: "Copper",
        from: "hand",
      };

      expect(isCardMovementEvent(event)).toBe(true);
    });

    it("returns true for CARD_GAINED", () => {
      const event: GameEvent = {
        type: "CARD_GAINED",
        playerId: "human",
        card: "Silver",
        to: "discard",
      };

      expect(isCardMovementEvent(event)).toBe(true);
    });

    it("returns true for CARD_PUT_ON_DECK", () => {
      const event: GameEvent = {
        type: "CARD_PUT_ON_DECK",
        playerId: "human",
        card: "Estate",
        from: "hand",
      };

      expect(isCardMovementEvent(event)).toBe(true);
    });

    it("returns false for CARD_REVEALED", () => {
      const event: GameEvent = {
        type: "CARD_REVEALED",
        playerId: "human",
        card: "Copper",
        from: "hand",
      };

      expect(isCardMovementEvent(event)).toBe(false);
    });

    it("returns false for resource events", () => {
      const event: GameEvent = {
        type: "ACTIONS_MODIFIED",
        delta: 1,
      };

      expect(isCardMovementEvent(event)).toBe(false);
    });

    it("returns false for turn events", () => {
      const event: GameEvent = {
        type: "TURN_STARTED",
        turn: 1,
        playerId: "human",
      };

      expect(isCardMovementEvent(event)).toBe(false);
    });
  });

  describe("isResourceEvent", () => {
    it("returns true for ACTIONS_MODIFIED", () => {
      const event: GameEvent = {
        type: "ACTIONS_MODIFIED",
        delta: 1,
      };

      expect(isResourceEvent(event)).toBe(true);
    });

    it("returns true for BUYS_MODIFIED", () => {
      const event: GameEvent = {
        type: "BUYS_MODIFIED",
        delta: 1,
      };

      expect(isResourceEvent(event)).toBe(true);
    });

    it("returns true for COINS_MODIFIED", () => {
      const event: GameEvent = {
        type: "COINS_MODIFIED",
        delta: 3,
      };

      expect(isResourceEvent(event)).toBe(true);
    });

    it("returns false for card movement events", () => {
      const event: GameEvent = {
        type: "CARD_DRAWN",
        playerId: "human",
        card: "Copper",
      };

      expect(isResourceEvent(event)).toBe(false);
    });

    it("returns false for turn events", () => {
      const event: GameEvent = {
        type: "TURN_STARTED",
        turn: 1,
        playerId: "human",
      };

      expect(isResourceEvent(event)).toBe(false);
    });
  });
});

describe("types - causality helpers", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  describe("isRootCauseEvent", () => {
    it("returns true for event without causedBy", () => {
      const event: GameEvent = {
        id: "evt-1",
        type: "CARD_PLAYED",
        playerId: "human",
        card: "Village",
        sourceIndex: 0,
      };

      expect(isRootCauseEvent(event)).toBe(true);
    });

    it("returns false for event with causedBy", () => {
      const event: GameEvent = {
        id: "evt-2",
        type: "ACTIONS_MODIFIED",
        delta: 1,
        causedBy: "evt-1",
      };

      expect(isRootCauseEvent(event)).toBe(false);
    });

    it("returns true for event with undefined causedBy", () => {
      const event: GameEvent = {
        id: "evt-1",
        type: "TURN_STARTED",
        turn: 1,
        playerId: "human",
        causedBy: undefined,
      };

      expect(isRootCauseEvent(event)).toBe(true);
    });
  });

  describe("getCausalChain", () => {
    it("returns single event for root with no children", () => {
      const events: GameEvent[] = [
        {
          id: "evt-1",
          type: "TURN_STARTED",
          turn: 1,
          playerId: "human",
        },
      ];

      const chain = getCausalChain("evt-1", events);

      expect(chain.size).toBe(1);
      expect(chain.has("evt-1")).toBe(true);
    });

    it("returns root and direct children", () => {
      const events: GameEvent[] = [
        {
          id: "evt-1",
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Village",
          sourceIndex: 0,
        },
        {
          id: "evt-2",
          type: "ACTIONS_MODIFIED",
          delta: 2,
          causedBy: "evt-1",
        },
        {
          id: "evt-3",
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Copper",
          causedBy: "evt-1",
        },
      ];

      const chain = getCausalChain("evt-1", events);

      expect(chain.size).toBe(3);
      expect(chain.has("evt-1")).toBe(true);
      expect(chain.has("evt-2")).toBe(true);
      expect(chain.has("evt-3")).toBe(true);
    });

    it("returns nested causal chains (grandchildren)", () => {
      const events: GameEvent[] = [
        {
          id: "evt-1",
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Village",
          sourceIndex: 0,
        },
        {
          id: "evt-2",
          type: "ACTIONS_MODIFIED",
          delta: 2,
          causedBy: "evt-1",
        },
        {
          id: "evt-3",
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Copper",
          causedBy: "evt-2",
        },
        {
          id: "evt-4",
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Silver",
          causedBy: "evt-3",
        },
      ];

      const chain = getCausalChain("evt-1", events);

      expect(chain.size).toBe(4);
      expect(chain.has("evt-1")).toBe(true);
      expect(chain.has("evt-2")).toBe(true);
      expect(chain.has("evt-3")).toBe(true);
      expect(chain.has("evt-4")).toBe(true);
    });

    it("excludes unrelated events", () => {
      const events: GameEvent[] = [
        {
          id: "evt-1",
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Village",
          sourceIndex: 0,
        },
        {
          id: "evt-2",
          type: "ACTIONS_MODIFIED",
          delta: 2,
          causedBy: "evt-1",
        },
        {
          id: "evt-3",
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Smithy",
          sourceIndex: 0,
        },
        {
          id: "evt-4",
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Copper",
          causedBy: "evt-3",
        },
      ];

      const chain = getCausalChain("evt-1", events);

      expect(chain.size).toBe(2);
      expect(chain.has("evt-1")).toBe(true);
      expect(chain.has("evt-2")).toBe(true);
      expect(chain.has("evt-3")).toBe(false);
      expect(chain.has("evt-4")).toBe(false);
    });

    it("handles mid-chain event as root", () => {
      const events: GameEvent[] = [
        {
          id: "evt-1",
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Village",
          sourceIndex: 0,
        },
        {
          id: "evt-2",
          type: "ACTIONS_MODIFIED",
          delta: 2,
          causedBy: "evt-1",
        },
        {
          id: "evt-3",
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Copper",
          causedBy: "evt-2",
        },
      ];

      const chain = getCausalChain("evt-2", events);

      expect(chain.size).toBe(2);
      expect(chain.has("evt-2")).toBe(true);
      expect(chain.has("evt-3")).toBe(true);
      expect(chain.has("evt-1")).toBe(false);
    });

    it("handles complex branching chains", () => {
      const events: GameEvent[] = [
        {
          id: "evt-1",
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Village",
          sourceIndex: 0,
        },
        {
          id: "evt-2",
          type: "ACTIONS_MODIFIED",
          delta: 2,
          causedBy: "evt-1",
        },
        {
          id: "evt-3",
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Copper",
          causedBy: "evt-1",
        },
        {
          id: "evt-4",
          type: "BUYS_MODIFIED",
          delta: 1,
          causedBy: "evt-2",
        },
        {
          id: "evt-5",
          type: "COINS_MODIFIED",
          delta: 1,
          causedBy: "evt-3",
        },
      ];

      const chain = getCausalChain("evt-1", events);

      expect(chain.size).toBe(5);
      expect(chain.has("evt-1")).toBe(true);
      expect(chain.has("evt-2")).toBe(true);
      expect(chain.has("evt-3")).toBe(true);
      expect(chain.has("evt-4")).toBe(true);
      expect(chain.has("evt-5")).toBe(true);
    });

    it("returns single event for leaf node", () => {
      const events: GameEvent[] = [
        {
          id: "evt-1",
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Village",
          sourceIndex: 0,
        },
        {
          id: "evt-2",
          type: "ACTIONS_MODIFIED",
          delta: 2,
          causedBy: "evt-1",
        },
      ];

      const chain = getCausalChain("evt-2", events);

      expect(chain.size).toBe(1);
      expect(chain.has("evt-2")).toBe(true);
    });

    it("handles non-existent event ID", () => {
      const events: GameEvent[] = [
        {
          id: "evt-1",
          type: "TURN_STARTED",
          turn: 1,
          playerId: "human",
        },
      ];

      const chain = getCausalChain("evt-99", events);

      expect(chain.size).toBe(1);
      expect(chain.has("evt-99")).toBe(true);
    });

    it("handles events without IDs", () => {
      const events: GameEvent[] = [
        {
          id: "evt-1",
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Village",
          sourceIndex: 0,
        },
        {
          type: "ACTIONS_MODIFIED",
          delta: 2,
          causedBy: "evt-1",
        } as GameEvent,
      ];

      const chain = getCausalChain("evt-1", events);

      expect(chain.size).toBe(1);
      expect(chain.has("evt-1")).toBe(true);
    });

    it("handles deeply nested chains (10+ levels)", () => {
      const events: GameEvent[] = [];
      for (let i = 1; i <= 15; i++) {
        events.push({
          id: `evt-${i}`,
          type: "ACTIONS_MODIFIED",
          delta: 1,
          causedBy: i > 1 ? `evt-${i - 1}` : undefined,
        });
      }

      const chain = getCausalChain("evt-1", events);

      expect(chain.size).toBe(15);
      for (let i = 1; i <= 15; i++) {
        expect(chain.has(`evt-${i}`)).toBe(true);
      }
    });
  });

  describe("removeEventChain", () => {
    it("removes event and all following events", () => {
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
        },
      ];

      const result = removeEventChain("evt-2", events);

      // Keeps evt-2 and everything before it (evt-1)
      // evt-3 is not caused by evt-2, so it's not included
      expect(result.length).toBe(2);
      expect(result.map(e => e.id)).toEqual(["evt-1", "evt-2"]);
    });

    it("keeps event and its direct effects", () => {
      const events: GameEvent[] = [
        {
          id: "evt-1",
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Village",
          sourceIndex: 0,
        },
        {
          id: "evt-2",
          type: "ACTIONS_MODIFIED",
          delta: 2,
          causedBy: "evt-1",
        },
        {
          id: "evt-3",
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Copper",
          causedBy: "evt-1",
        },
        {
          id: "evt-4",
          type: "TURN_ENDED",
          turn: 1,
          playerId: "human",
        },
      ];

      const result = removeEventChain("evt-1", events);

      expect(result.length).toBe(3);
      expect(result[0]!.id).toBe("evt-1");
      expect(result[1]!.id).toBe("evt-2");
      expect(result[2]!.id).toBe("evt-3");
    });

    it("handles nested effects (transitive causedBy)", () => {
      const events: GameEvent[] = [
        {
          id: "evt-1",
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Village",
          sourceIndex: 0,
        },
        {
          id: "evt-2",
          type: "ACTIONS_MODIFIED",
          delta: 2,
          causedBy: "evt-1",
        },
        {
          id: "evt-3",
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Copper",
          causedBy: "evt-2",
        },
        {
          id: "evt-4",
          type: "TURN_ENDED",
          turn: 1,
          playerId: "human",
        },
      ];

      const result = removeEventChain("evt-1", events);

      expect(result.length).toBe(3);
      expect(result[0]!.id).toBe("evt-1");
      expect(result[1]!.id).toBe("evt-2");
      expect(result[2]!.id).toBe("evt-3");
    });

    it("returns original array if event not found", () => {
      const events: GameEvent[] = [
        {
          id: "evt-1",
          type: "TURN_STARTED",
          turn: 1,
          playerId: "human",
        },
      ];

      const result = removeEventChain("evt-99", events);

      expect(result).toEqual(events);
    });

    it("handles removing first event", () => {
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
      ];

      const result = removeEventChain("evt-1", events);

      expect(result.length).toBe(1);
      expect(result[0]!.id).toBe("evt-1");
    });

    it("handles removing last event", () => {
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
      ];

      const result = removeEventChain("evt-2", events);

      expect(result.length).toBe(2);
      expect(result[0]!.id).toBe("evt-1");
      expect(result[1]!.id).toBe("evt-2");
    });

    it("handles event in middle of chain", () => {
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
        {
          id: "evt-4",
          type: "TURN_ENDED",
          turn: 1,
          playerId: "human",
        },
      ];

      const result = removeEventChain("evt-2", events);

      expect(result.length).toBe(3);
      expect(result.map(e => e.id)).toEqual(["evt-1", "evt-2", "evt-3"]);
    });

    it("handles complex branching effects", () => {
      const events: GameEvent[] = [
        {
          id: "evt-1",
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Village",
          sourceIndex: 0,
        },
        {
          id: "evt-2",
          type: "ACTIONS_MODIFIED",
          delta: 2,
          causedBy: "evt-1",
        },
        {
          id: "evt-3",
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Copper",
          causedBy: "evt-1",
        },
        {
          id: "evt-4",
          type: "BUYS_MODIFIED",
          delta: 1,
          causedBy: "evt-2",
        },
        {
          id: "evt-5",
          type: "TURN_ENDED",
          turn: 1,
          playerId: "human",
        },
      ];

      const result = removeEventChain("evt-1", events);

      expect(result.length).toBe(4);
      expect(result.map(e => e.id)).toEqual(["evt-1", "evt-2", "evt-3", "evt-4"]);
    });

    it("stops at next root event", () => {
      const events: GameEvent[] = [
        {
          id: "evt-1",
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Village",
          sourceIndex: 0,
        },
        {
          id: "evt-2",
          type: "ACTIONS_MODIFIED",
          delta: 2,
          causedBy: "evt-1",
        },
        {
          id: "evt-3",
          type: "CARD_PLAYED",
          playerId: "human",
          card: "Smithy",
          sourceIndex: 0,
        },
        {
          id: "evt-4",
          type: "CARD_DRAWN",
          playerId: "human",
          card: "Copper",
          causedBy: "evt-3",
        },
      ];

      const result = removeEventChain("evt-1", events);

      expect(result.length).toBe(2);
      expect(result.map(e => e.id)).toEqual(["evt-1", "evt-2"]);
    });

    it("handles empty event array", () => {
      const result = removeEventChain("evt-1", []);

      expect(result).toEqual([]);
    });

    it("handles events without IDs", () => {
      const events: GameEvent[] = [
        {
          id: "evt-1",
          type: "TURN_STARTED",
          turn: 1,
          playerId: "human",
        },
        {
          type: "ACTIONS_MODIFIED",
          delta: 1,
        } as GameEvent,
      ];

      const result = removeEventChain("evt-1", events);

      expect(result.length).toBe(1);
      expect(result[0]!.id).toBe("evt-1");
    });
  });
});
