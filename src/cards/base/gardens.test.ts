import { requestOf } from "../test-helpers";
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

describe("Gardens", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should have no active effect when played", () => {
    const state = createTestState();

    const result = gardens.run(
      {
        state,
        playerId: "human",
        card: "Gardens",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      { type: "start" },
    );

    expect(result.events).toEqual([]);
    expect(requestOf(result)).toBeUndefined();
  });

  it("should have no effect regardless of game state", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper", "Copper", "Copper"];
    state.players["human"]!.deck = ["Estate", "Estate"];
    state.players["human"]!.discard = ["Silver", "Gold"];

    const result = gardens.run(
      {
        state,
        playerId: "human",
        card: "Gardens",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      { type: "start" },
    );

    expect(result.events).toEqual([]);
  });

  it("should have no effect with missing player", () => {
    const state = createTestState();

    const result = gardens.run(
      {
        state,
        playerId: "nonexistent",
        card: "Gardens",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      { type: "start" },
    );

    expect(result.events).toEqual([]);
  });

  it("should have no effect with decision passed", () => {
    const state = createTestState();

    const result = gardens.run(
      {
        state,
        playerId: "human",
        card: "Gardens",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      { type: "answer", memory: null, answer: { selectedCards: ["Copper"] } },
    );

    expect(result.events).toEqual([]);
  });
});
