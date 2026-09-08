import { requestOf } from "../test-helpers";
import { describe, it, expect, beforeEach } from "bun:test";
import { cellar } from "./cellar";
import type { GameState } from "../../types/game-state";
import type { GameEvent } from "../../events/types";
import { resetEventCounter } from "../../events/id-generator";
import { applyEvents } from "../../events/apply";

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

describe("Cellar - duplicate card handling", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should discard multiple cards in batch and draw that many", () => {
    const state = createTestState();
    // Player has 3 Estates, wants to discard 2
    state.players["human"]!.hand = [
      "Estate",
      "Estate",
      "Estate",
      "Copper",
      "Silver",
    ];
    state.players["human"]!.deck = ["Gold", "Gold", "Gold"]; // Cards to draw

    // Initial call - get decision
    const result1 = cellar.run(
      {
        state,
        playerId: "human",
        card: "Cellar",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      { type: "start" },
    );

    expect(requestOf(result1)).toBeDefined();
    expect(requestOf(result1)?.min).toBe(0);
    expect(requestOf(result1)?.max).toBe(5); // Can discard all

    // Discard 2 Estates in batch
    if (requestOf(result1)) {
      state.pendingChoice = requestOf(result1)!;
    }
    const result2 = cellar.run(
      {
        state,
        playerId: "human",
        card: "Cellar",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      {
        type: "answer",
        memory: null,
        answer: { selectedCards: ["Estate", "Estate"] },
      },
    );

    const discardEvents = result2.events.filter(
      e => e.type === "CARD_DISCARDED",
    );
    const drawEvents = result2.events.filter(
      (e: GameEvent) => e.type === "CARD_DRAWN",
    );

    expect(discardEvents.length).toBe(2); // Discarded 2
    expect(drawEvents.length).toBe(2); // Drew 2
    expect(requestOf(result2)).toBeUndefined(); // Done after batch
  });

  it("should handle skipping immediately (discard zero)", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Estate", "Estate", "Copper"];
    state.players["human"]!.deck = ["Gold", "Gold"];

    const result1 = cellar.run(
      {
        state,
        playerId: "human",
        card: "Cellar",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      { type: "start" },
    );

    if (requestOf(result1)) {
      state.pendingChoice = requestOf(result1)!;
    }

    // Skip immediately by submitting empty array
    const result2 = cellar.run(
      {
        state,
        playerId: "human",
        card: "Cellar",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      { type: "answer", memory: null, answer: { selectedCards: [] } },
    );

    // Should have no events (no discards, no draws)
    expect(result2.events.length).toBe(0);
  });

  it("should handle discarding all cards in hand", () => {
    let state = createTestState();
    state.players["human"]!.hand = ["Estate", "Copper"];
    state.players["human"]!.deck = ["Gold", "Gold"];

    const result1 = cellar.run(
      {
        state,
        playerId: "human",
        card: "Cellar",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      { type: "start" },
    );

    // Apply initial events and update state
    state = applyEvents(state, result1.events);
    if (requestOf(result1)) {
      state.pendingChoice = requestOf(result1)!;
    }

    // Discard entire hand in batch
    const result2 = cellar.run(
      {
        state,
        playerId: "human",
        card: "Cellar",
        trigger: { type: "play" },
        random: () => 0.5,
      },
      {
        type: "answer",
        memory: null,
        answer: { selectedCards: ["Estate", "Copper"] },
      },
    );

    // Should discard both and draw 2
    const discardEvents = result2.events.filter(
      e => e.type === "CARD_DISCARDED",
    );
    const drawEvents = result2.events.filter(
      (e: GameEvent) => e.type === "CARD_DRAWN",
    );
    expect(discardEvents.length).toBe(2); // Discarded both
    expect(drawEvents.length).toBe(2); // Drew 2
    expect(requestOf(result2)).toBeUndefined(); // Done
  });
});
