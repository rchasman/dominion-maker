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

describe("Moneylender", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should do nothing if no Copper in hand", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Estate", "Silver", "Gold"];

    const result = moneylender({
      state,
      playerId: "human",
      card: "Moneylender",
    });

    expect(result.events).toEqual([]);
    expect(result.pendingChoice).toBeUndefined();
  });

  it("should prompt to trash Copper if present", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper", "Estate", "Silver"];

    const result = moneylender({
      state,
      playerId: "human",
      card: "Moneylender",
    });

    expect(result.pendingChoice).toBeDefined();
    expect(result.pendingChoice?.cardOptions).toEqual(["Copper"]);
    expect(result.pendingChoice?.min).toBe(0);
    expect(result.pendingChoice?.max).toBe(1);
    expect(result.pendingChoice?.prompt).toContain("Trash a Copper for +$3");
  });

  it("should trash Copper and grant +$3 when chosen", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper", "Estate"];
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "human",
      from: "hand",
      prompt: "Moneylender: Trash a Copper for +$3?",
      cardOptions: ["Copper"],
      min: 0,
      max: 1,
      cardBeingPlayed: "Moneylender",
      stage: "trash",
    };

    const result = moneylender({
      state,
      playerId: "human",
      card: "Moneylender",
      decision: { selectedCards: ["Copper"] },
    });

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
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "human",
      from: "hand",
      prompt: "Moneylender: Trash a Copper for +$3?",
      cardOptions: ["Copper"],
      min: 0,
      max: 1,
      cardBeingPlayed: "Moneylender",
      stage: "trash",
    };

    const result = moneylender({
      state,
      playerId: "human",
      card: "Moneylender",
      decision: { selectedCards: [] },
    });

    expect(result.events).toEqual([]);
  });

  it("should handle multiple Coppers in hand", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper", "Copper", "Copper"];

    const result = moneylender({
      state,
      playerId: "human",
      card: "Moneylender",
    });

    expect(result.pendingChoice).toBeDefined();
    expect(result.pendingChoice?.max).toBe(1); // Only trash one
  });

  it("should handle missing player state", () => {
    const state = createTestState();

    const result = moneylender({
      state,
      playerId: "nonexistent" as any,
      card: "Moneylender",
    });

    expect(result.events).toEqual([]);
  });

  it("should handle decision with wrong card selected", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper", "Estate"];
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "human",
      from: "hand",
      prompt: "Moneylender: Trash a Copper for +$3?",
      cardOptions: ["Copper"],
      min: 0,
      max: 1,
      cardBeingPlayed: "Moneylender",
      stage: "trash",
    };

    const result = moneylender({
      state,
      playerId: "human",
      card: "Moneylender",
      decision: { selectedCards: ["Estate" as any] },
    });

    expect(result.events).toEqual([]);
  });

  it("should handle only Copper in hand", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper"];

    const result = moneylender({
      state,
      playerId: "human",
      card: "Moneylender",
    });

    expect(result.pendingChoice).toBeDefined();
    expect(result.pendingChoice?.cardOptions).toEqual(["Copper"]);
  });
});
