import { describe, it, expect, beforeEach } from "bun:test";
import { gardens } from "./gardens";
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

describe("Gardens", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should have no active effect when played", () => {
    const state = createTestState();

    const result = gardens({
      state,
      playerId: "human",
      card: "Gardens",
    });

    expect(result.events).toEqual([]);
    expect(result.pendingChoice).toBeUndefined();
  });

  it("should have no effect regardless of game state", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper", "Copper", "Copper"];
    state.players["human"]!.deck = ["Estate", "Estate"];
    state.players["human"]!.discard = ["Silver", "Gold"];

    const result = gardens({
      state,
      playerId: "human",
      card: "Gardens",
    });

    expect(result.events).toEqual([]);
  });

  it("should have no effect with missing player", () => {
    const state = createTestState();

    const result = gardens({
      state,
      playerId: "nonexistent" as any,
      card: "Gardens",
    });

    expect(result.events).toEqual([]);
  });

  it("should have no effect with decision passed", () => {
    const state = createTestState();

    const result = gardens({
      state,
      playerId: "human",
      card: "Gardens",
      decision: { selectedCards: ["Copper"] },
    });

    expect(result.events).toEqual([]);
  });
});
