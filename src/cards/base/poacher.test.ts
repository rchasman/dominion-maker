import { describe, it, expect, beforeEach } from "bun:test";
import { poacher } from "./poacher";
import type { GameState } from "../../types/game-state";
import { resetEventCounter } from "../../events/id-generator";

function createTestState(): GameState {
  return {
    playerOrder: ["human", "ai"],
    activePlayerId: "human",
    phase: "action",
    turn: 1,
    actions: 1,
    buys: 1,
    coins: 0,
    players: {
      human: {
        hand: [],
        deck: [],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
      ai: {
        hand: [],
        deck: [],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
    },
    supply: {},
    trash: [],
    log: [],
    turnHistory: [],
    kingdomCards: [],
    pendingChoice: null,
    pendingChoiceEventId: null,
    gameOver: false,
    winnerId: null,
    activeEffects: [],
  };
}

describe("Poacher", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should grant +1 Card, +1 Action, +$1 with no empty piles", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper"];
    state.players["human"]!.deck = ["Silver"];
    state.supply = {
      Copper: 10,
      Silver: 10,
      Gold: 10,
    };

    const result = poacher({
      state,
      playerId: "human",
      card: "Poacher",
    });

    expect(result.events).toContainEqual({ type: "ACTIONS_MODIFIED", delta: 1 });
    expect(result.events).toContainEqual({ type: "COINS_MODIFIED", delta: 1 });
    const drawEvents = result.events.filter(e => e.type === "CARD_DRAWN");
    expect(drawEvents.length).toBe(1);
    expect(result.pendingChoice).toBeUndefined();
  });

  it("should prompt to discard for each empty pile", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper", "Estate", "Silver"];
    state.players["human"]!.deck = ["Gold"];
    state.supply = {
      Copper: 0,
      Silver: 0,
      Gold: 10,
    };

    const result = poacher({
      state,
      playerId: "human",
      card: "Poacher",
    });

    expect(result.pendingChoice).toBeDefined();
    expect(result.pendingChoice?.min).toBe(2);
    expect(result.pendingChoice?.max).toBe(2);
    expect(result.pendingChoice?.prompt).toContain("2 empty pile(s)");
  });

  it("should discard selected cards", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper", "Estate", "Silver"];
    state.supply = {
      Copper: 0,
      Silver: 10,
    };
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "human",
      from: "hand",
      prompt: "Poacher: Discard 1 card(s) (1 empty pile(s))",
      cardOptions: ["Copper", "Estate", "Silver"],
      min: 1,
      max: 1,
      cardBeingPlayed: "Poacher",
      stage: "discard",
    };

    const result = poacher({
      state,
      playerId: "human",
      card: "Poacher",
      decision: { selectedCards: ["Estate"] },
      stage: "discard",
    });

    const discardEvents = result.events.filter(e => e.type === "CARD_DISCARDED");
    expect(discardEvents.length).toBe(1);
    expect(discardEvents[0]?.card).toBe("Estate");
    expect(discardEvents[0]?.from).toBe("hand");
  });

  it("should discard multiple cards for multiple empty piles", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper", "Estate", "Silver", "Gold"];
    state.supply = {
      Copper: 0,
      Estate: 0,
      Duchy: 0,
    };
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "human",
      from: "hand",
      prompt: "Poacher: Discard 3 card(s) (3 empty pile(s))",
      cardOptions: ["Copper", "Estate", "Silver", "Gold"],
      min: 3,
      max: 3,
      cardBeingPlayed: "Poacher",
      stage: "discard",
    };

    const result = poacher({
      state,
      playerId: "human",
      card: "Poacher",
      decision: { selectedCards: ["Copper", "Estate", "Silver"] },
      stage: "discard",
    });

    const discardEvents = result.events.filter(e => e.type === "CARD_DISCARDED");
    expect(discardEvents.length).toBe(3);
  });

  it("should limit discard to hand size if fewer cards than empty piles", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper", "Estate"];
    state.players["human"]!.deck = ["Gold"];
    state.supply = {
      Copper: 0,
      Estate: 0,
      Duchy: 0,
      Province: 0,
      Silver: 0,
    };

    const result = poacher({
      state,
      playerId: "human",
      card: "Poacher",
    });

    expect(result.pendingChoice).toBeDefined();
    expect(result.pendingChoice?.min).toBe(2); // Only 2 cards in hand after draw
    expect(result.pendingChoice?.max).toBe(2);
  });

  it("should not prompt for discard if hand is empty after draw", () => {
    const state = createTestState();
    state.players["human"]!.hand = [];
    state.players["human"]!.deck = [];
    state.supply = {
      Copper: 0,
      Estate: 0,
    };

    const result = poacher({
      state,
      playerId: "human",
      card: "Poacher",
    });

    expect(result.pendingChoice).toBeUndefined();
    expect(result.events).toContainEqual({ type: "ACTIONS_MODIFIED", delta: 1 });
    expect(result.events).toContainEqual({ type: "COINS_MODIFIED", delta: 1 });
  });

  it("should handle missing player state", () => {
    const state = createTestState();

    const result = poacher({
      state,
      playerId: "nonexistent" as any,
      card: "Poacher",
    });

    expect(result.events).toEqual([]);
  });

  it("should return empty events for unknown stage", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper"];

    const result = poacher({
      state,
      playerId: "human",
      card: "Poacher",
      decision: { selectedCards: [] },
      stage: "unknown_stage" as any,
    });

    expect(result.events).toEqual([]);
  });

  it("should handle exactly hand size empty piles", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper", "Estate"];
    state.players["human"]!.deck = ["Silver"];
    state.supply = {
      Copper: 0,
      Estate: 0,
      Duchy: 0,
    };

    const result = poacher({
      state,
      playerId: "human",
      card: "Poacher",
    });

    expect(result.pendingChoice).toBeDefined();
    // Hand has 2 cards, 3 empty piles, but can only discard what's in hand (2)
    expect(result.pendingChoice?.min).toBe(2);
    expect(result.pendingChoice?.max).toBe(2);
  });
});
