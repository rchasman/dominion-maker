import { describe, it, expect, beforeEach } from "bun:test";
import { vassal } from "./vassal";
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

describe("Vassal", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should grant +$2 and discard top card with empty deck", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper"];
    state.players["human"]!.deck = [];

    const result = vassal({
      state,
      playerId: "human",
      card: "Vassal",
    });

    expect(result.events).toContainEqual({ type: "COINS_MODIFIED", delta: 2 });
    expect(result.pendingChoice).toBeUndefined();
  });

  it("should discard non-action card without prompting", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper"];
    state.players["human"]!.deck = ["Silver"];

    const result = vassal({
      state,
      playerId: "human",
      card: "Vassal",
    });

    expect(result.events).toContainEqual({ type: "COINS_MODIFIED", delta: 2 });
    expect(result.events).toContainEqual({
      type: "CARD_DISCARDED",
      playerId: "human",
      card: "Silver",
      from: "deck",
    });
    expect(result.pendingChoice).toBeUndefined();
  });

  it("should prompt to play action card from discard", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper"];
    state.players["human"]!.deck = ["Village"];

    const result = vassal({
      state,
      playerId: "human",
      card: "Vassal",
    });

    expect(result.events).toContainEqual({ type: "COINS_MODIFIED", delta: 2 });
    expect(result.events).toContainEqual({
      type: "CARD_DISCARDED",
      playerId: "human",
      card: "Village",
      from: "deck",
    });
    expect(result.pendingChoice).toBeDefined();
    expect(result.pendingChoice?.cardOptions).toEqual(["Village"]);
    expect(result.pendingChoice?.min).toBe(0);
    expect(result.pendingChoice?.max).toBe(1);
  });

  it("should play action from discard when chosen", () => {
    const state = createTestState();
    state.players["human"]!.discard = ["Village"];
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "human",
      from: "options",
      prompt: "Vassal: Play Village from discard?",
      cardOptions: ["Village"],
      min: 0,
      max: 1,
      cardBeingPlayed: "Vassal",
      stage: "play_action",
      metadata: { discardedCard: "Village" },
    };

    const result = vassal({
      state,
      playerId: "human",
      card: "Vassal",
      decision: { selectedCards: ["Village"] },
      stage: "play_action",
    });

    expect(result.events).toContainEqual({
      type: "CARD_PLAYED",
      playerId: "human",
      card: "Village",
      sourceIndex: 0,
    });
  });

  it("should not play action when declined", () => {
    const state = createTestState();
    state.players["human"]!.discard = ["Village"];
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "human",
      from: "options",
      prompt: "Vassal: Play Village from discard?",
      cardOptions: ["Village"],
      min: 0,
      max: 1,
      cardBeingPlayed: "Vassal",
      stage: "play_action",
      metadata: { discardedCard: "Village" },
    };

    const result = vassal({
      state,
      playerId: "human",
      card: "Vassal",
      decision: { selectedCards: [] },
      stage: "play_action",
    });

    expect(result.events).toEqual([]);
  });

  it("should handle missing player state", () => {
    const state = createTestState();

    const result = vassal({
      state,
      playerId: "nonexistent" as any,
      card: "Vassal",
    });

    expect(result.events).toEqual([]);
  });

  it("should handle undefined top card", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper"];
    state.players["human"]!.deck = [];

    const result = vassal({
      state,
      playerId: "human",
      card: "Vassal",
    });

    expect(result.events).toContainEqual({ type: "COINS_MODIFIED", delta: 2 });
  });

  it("should handle various action cards", () => {
    const actionCards = ["Smithy", "Market", "Militia", "Throne Room"];

    actionCards.forEach(card => {
      const state = createTestState();
      state.players["human"]!.deck = [card as any];

      const result = vassal({
        state,
        playerId: "human",
        card: "Vassal",
      });

      expect(result.pendingChoice).toBeDefined();
      expect(result.pendingChoice?.cardOptions).toEqual([card]);
    });
  });

  it("should return empty events for unknown stage", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper"];

    const result = vassal({
      state,
      playerId: "human",
      card: "Vassal",
      decision: { selectedCards: [] },
      stage: "unknown_stage" as any,
    });

    expect(result.events).toEqual([]);
  });

  it("should handle treasure card discards", () => {
    const treasures = ["Copper", "Silver", "Gold"];

    treasures.forEach(treasure => {
      const state = createTestState();
      state.players["human"]!.deck = [treasure as any];

      const result = vassal({
        state,
        playerId: "human",
        card: "Vassal",
      });

      expect(result.events).toContainEqual({
        type: "CARD_DISCARDED",
        playerId: "human",
        card: treasure,
        from: "deck",
      });
      expect(result.pendingChoice).toBeUndefined();
    });
  });

  it("should handle victory card discards", () => {
    const victories = ["Estate", "Duchy", "Province"];

    victories.forEach(victory => {
      const state = createTestState();
      state.players["human"]!.deck = [victory as any];

      const result = vassal({
        state,
        playerId: "human",
        card: "Vassal",
      });

      expect(result.events).toContainEqual({
        type: "CARD_DISCARDED",
        playerId: "human",
        card: victory,
        from: "deck",
      });
      expect(result.pendingChoice).toBeUndefined();
    });
  });
});
