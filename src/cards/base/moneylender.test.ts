import { requestOf } from "../test-helpers";
import { describe, it, expect, beforeEach } from "bun:test";
import { moneylender } from "./moneylender";
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

describe("Moneylender", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should do nothing if no Copper in hand", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Estate", "Silver", "Gold"];

    const result = moneylender.run(
      {
        state,
        playerId: "human",
        card: "Moneylender",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      { type: "start" },
    );

    expect(result.events).toEqual([]);
    expect(requestOf(result)).toBeUndefined();
  });

  it("should prompt to trash Copper if present", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper", "Estate", "Silver"];

    const result = moneylender.run(
      {
        state,
        playerId: "human",
        card: "Moneylender",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      { type: "start" },
    );

    expect(requestOf(result)).toBeDefined();
    expect(requestOf(result)?.cardOptions).toEqual(["Copper"]);
    expect(requestOf(result)?.min).toBe(0);
    expect(requestOf(result)?.max).toBe(1);
    expect(requestOf(result)?.prompt).toContain("Trash a Copper for +$3");
  });

  it("should trash Copper and grant +$3 when chosen", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper", "Estate"];

    const result = moneylender.run(
      {
        state,
        playerId: "human",
        card: "Moneylender",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      { type: "answer", memory: null, answer: { selectedCards: ["Copper"] } },
    );

    expect(result.events).toContainEqual({
      type: "CARD_TRASHED",
      playerId: "human",
      card: "Copper",
      from: "hand",
    });
    expect(result.events).toContainEqual({ type: "COINS_MODIFIED", delta: 3 });
  });

  it("should do nothing when player declines to trash", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper", "Estate"];

    const result = moneylender.run(
      {
        state,
        playerId: "human",
        card: "Moneylender",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      { type: "answer", memory: null, answer: { selectedCards: [] } },
    );

    expect(result.events).toEqual([]);
  });

  it("should handle multiple Coppers in hand", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper", "Copper", "Copper"];

    const result = moneylender.run(
      {
        state,
        playerId: "human",
        card: "Moneylender",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      { type: "start" },
    );

    expect(requestOf(result)).toBeDefined();
    expect(requestOf(result)?.max).toBe(1); // Only trash one
  });

  it("should handle missing player state", () => {
    const state = createTestState();

    const result = moneylender.run(
      {
        state,
        playerId: "nonexistent",
        card: "Moneylender",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      { type: "start" },
    );

    expect(result.events).toEqual([]);
  });

  it("should handle decision with wrong card selected", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper", "Estate"];

    const result = moneylender.run(
      {
        state,
        playerId: "human",
        card: "Moneylender",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      {
        type: "answer",
        memory: null,
        answer: { selectedCards: ["Estate"] },
      },
    );

    expect(result.events).toEqual([]);
  });

  it("should handle only Copper in hand", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper"];

    const result = moneylender.run(
      {
        state,
        playerId: "human",
        card: "Moneylender",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      { type: "start" },
    );

    expect(requestOf(result)).toBeDefined();
    expect(requestOf(result)?.cardOptions).toEqual(["Copper"]);
  });
});
