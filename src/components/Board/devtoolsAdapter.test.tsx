import { beforeAll, describe, it, expect } from "bun:test";
import { render } from "preact";
import { registerHappyDom, settled } from "../../happy-dom.test-fixture";
import type { EventDevtoolsAdapter } from "../EventDevtools/adapter";
import type { GameEvent } from "../../events/types";
import { useDominionDevtoolsAdapter } from "./devtoolsAdapter";

beforeAll(registerHappyDom);

/** The adapter as the board builds it, through the hook that memoizes it */
const adapterFor = (events: GameEvent[]): EventDevtoolsAdapter<GameEvent> => {
  const root = document.createElement("div");
  const built: EventDevtoolsAdapter<GameEvent>[] = [];
  const Probe = () => {
    built.push(useDominionDevtoolsAdapter(events));
    return null;
  };
  settled(() => {
    render(<Probe />, root);
  });
  render(null, root);
  const adapter = built.at(-1);
  if (adapter === undefined) throw new Error("the hook never rendered");
  return adapter;
};

const formatEvent = (event: GameEvent): string =>
  adapterFor([event]).label(event);

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

  it("falls back to the event type where it has nothing better to say", () => {
    const event: GameEvent = {
      id: "17",
      type: "DECK_SHUFFLED",
      playerId: "human",
    };
    expect(formatEvent(event)).toBe("DECK_SHUFFLED");
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
  const adapter = () => adapterFor([turnStarted, causedDraw]);

  it("keeps today's filter chips", () => {
    expect([...adapter().categories]).toEqual([
      "turns",
      "cards",
      "resources",
      "decisions",
    ]);
    expect(adapter().category(turnStarted)).toBe("turns");
  });

  it("stops the scrubber on events nothing caused", () => {
    expect(adapter().isRoot(turnStarted)).toBe(true);
    expect(adapter().isRoot(causedDraw)).toBe(false);
  });

  it("keeps a colour per event type", () => {
    expect(adapter().colour(turnStarted)).toBe("#f59e0b");
    expect(
      adapter().colour({
        id: "x",
        type: "GAME_ENDED",
        winnerId: "human",
        scores: {},
        reason: "provinces_empty",
      }),
    ).toBe("#dc2626");
  });

  it("projects a local log up to and including the index", () => {
    const opened: GameEvent = {
      id: "e0",
      type: "GAME_INITIALIZED",
      players: ["human", "ai"],
      kingdomCards: ["Village"],
      supply: { Village: 10 },
    };
    const local = adapterFor([opened, turnStarted, causedDraw]);
    expect(local.stateAt?.(1)).toMatchObject({ turn: 1 });
  });
});
