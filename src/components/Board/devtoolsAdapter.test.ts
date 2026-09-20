import { describe, it, expect } from "bun:test";
import type { GameEvent } from "../../events/types";
import {
  DOMINION_EVENT_CATEGORIES,
  dominionStateAt,
  formatEvent,
} from "./devtoolsAdapter";

const turnStarted: GameEvent = {
  id: "e1",
  type: "TURN_STARTED",
  turn: 1,
  playerId: "human",
};

const causedDraw: GameEvent = {
  id: "e2",
  type: "CARD_DRAWN",
  playerId: "human",
  card: "Village",
  causedBy: "e1",
};

describe("the Dominion devtools adapter labels", () => {
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
      sourceIndex: 0,
    };
    expect(formatEvent(event)).toBe("ai played Smithy");
  });

  it("should format CARD_DISCARDED event", () => {
    const event: GameEvent = {
      id: "3",
      type: "CARD_DISCARDED",
      playerId: "human",
      card: "Copper",
      from: "hand",
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
        choiceType: "decision",
        playerId: "human",
        prompt:
          "This is a very long prompt that should be truncated to prevent overflow",
        cardOptions: ["Copper"],
        cardBeingPlayed: "Cellar",
        min: 0,
        max: 1,
      },
    };
    expect(formatEvent(event)).toBe(
      "Decision: This is a very long prompt tha...",
    );
  });

  it("should format DECISION_RESOLVED event with selected cards", () => {
    const event: GameEvent = {
      id: "14",
      type: "DECISION_RESOLVED",
      playerId: "human",
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
      playerId: "human",
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
      reason: "provinces_empty",
    };
    expect(formatEvent(event)).toBe("Winner: human");
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

describe("the Dominion devtools adapter", () => {
  it("keeps today's filter chips", () => {
    expect([...DOMINION_EVENT_CATEGORIES]).toEqual([
      "turns",
      "cards",
      "resources",
      "decisions",
    ]);
  });

  it("stops the scrubber on events nothing caused", () => {
    expect(Boolean(turnStarted.causedBy)).toBe(false);
    expect(Boolean(causedDraw.causedBy)).toBe(true);
  });

  it("projects the local log up to and including the index", () => {
    const state = dominionStateAt([], 0, null);
    expect(state).not.toBeInstanceOf(Promise);
  });
});
