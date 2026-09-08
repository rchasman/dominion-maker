import { requestOf } from "../test-helpers";
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
    supply: {} as GameState["supply"],
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
    } as GameState["supply"];

    const result = poacher.run(
      {
        state,
        playerId: "human",
        card: "Poacher",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      { type: "start" },
    );

    expect(result.events).toContainEqual({
      type: "ACTIONS_MODIFIED",
      delta: 1,
    });
    expect(result.events).toContainEqual({ type: "COINS_MODIFIED", delta: 1 });
    const drawEvents = result.events.filter(e => e.type === "CARD_DRAWN");
    expect(drawEvents.length).toBe(1);
    expect(requestOf(result)).toBeUndefined();
  });

  it("should prompt to discard for each empty pile", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper", "Estate", "Silver"];
    state.players["human"]!.deck = ["Gold"];
    state.supply = {
      Copper: 0,
      Silver: 0,
      Gold: 10,
    } as GameState["supply"];

    const result = poacher.run(
      {
        state,
        playerId: "human",
        card: "Poacher",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      { type: "start" },
    );

    expect(requestOf(result)).toBeDefined();
    expect(requestOf(result)?.min).toBe(2);
    expect(requestOf(result)?.max).toBe(2);
    expect(requestOf(result)?.prompt).toContain("2 empty pile(s)");
  });

  it("should discard selected cards", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper", "Estate", "Silver"];
    state.supply = {
      Copper: 0,
      Silver: 10,
    } as GameState["supply"];

    const result = poacher.run(
      {
        state,
        playerId: "human",
        card: "Poacher",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      { type: "answer", memory: null, answer: { selectedCards: ["Estate"] } },
    );

    const discardEvents = result.events.filter(
      e => e.type === "CARD_DISCARDED",
    );
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
    } as GameState["supply"];

    const result = poacher.run(
      {
        state,
        playerId: "human",
        card: "Poacher",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      {
        type: "answer",
        memory: null,
        answer: { selectedCards: ["Copper", "Estate", "Silver"] },
      },
    );

    const discardEvents = result.events.filter(
      e => e.type === "CARD_DISCARDED",
    );
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
    } as GameState["supply"];

    const result = poacher.run(
      {
        state,
        playerId: "human",
        card: "Poacher",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      { type: "start" },
    );

    expect(requestOf(result)).toBeDefined();
    expect(requestOf(result)?.min).toBe(3); // Includes the newly drawn card
    expect(requestOf(result)?.max).toBe(3);
  });

  it("should not prompt for discard if hand is empty after draw", () => {
    const state = createTestState();
    state.players["human"]!.hand = [];
    state.players["human"]!.deck = [];
    state.supply = {
      Copper: 0,
      Estate: 0,
    } as GameState["supply"];

    const result = poacher.run(
      {
        state,
        playerId: "human",
        card: "Poacher",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      { type: "start" },
    );

    expect(requestOf(result)).toBeUndefined();
    expect(result.events).toContainEqual({
      type: "ACTIONS_MODIFIED",
      delta: 1,
    });
    expect(result.events).toContainEqual({ type: "COINS_MODIFIED", delta: 1 });
  });

  it("should handle missing player state", () => {
    const state = createTestState();

    const result = poacher.run(
      {
        state,
        playerId: "nonexistent",
        card: "Poacher",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      { type: "start" },
    );

    expect(result.events).toEqual([]);
  });

  it("should reject malformed saved memory", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper"];

    expect(() =>
      poacher.run(
        {
          state,
          playerId: "human",
          card: "Poacher",
          trigger: { type: "play" },
          random: () => 0.5,
        },
        {
          type: "answer",
          memory: "unknown_stage",
          answer: { selectedCards: [] },
        },
      ),
    ).toThrow();
  });

  it("should handle exactly hand size empty piles", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper", "Estate"];
    state.players["human"]!.deck = ["Silver"];
    state.supply = {
      Copper: 0,
      Estate: 0,
      Duchy: 0,
    } as GameState["supply"];

    const result = poacher.run(
      {
        state,
        playerId: "human",
        card: "Poacher",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      { type: "start" },
    );

    expect(requestOf(result)).toBeDefined();
    // All three cards, including the draw, must be discarded.
    expect(requestOf(result)?.min).toBe(3);
    expect(requestOf(result)?.max).toBe(3);
  });
});
