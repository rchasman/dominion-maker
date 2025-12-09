import { describe, it, expect, beforeEach } from "bun:test";
import { cellar } from "./cellar";
import type { GameState } from "../../types/game-state";
import { resetEventCounter } from "../../events/id-generator";

function createTestState(): GameState {
  return {
    playerOrder: ["human", "ai"],
    activePlayer: "human",
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
  };
}

describe("Cellar - duplicate card handling", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should only discard selected copies, not all copies", () => {
    const state = createTestState();
    // Player has 3 Estates, wants to discard 2
    state.players.human.hand = ["Estate", "Estate", "Estate", "Copper", "Silver"];
    state.players.human.deck = ["Gold", "Gold", "Gold"]; // Cards to draw

    // Initial call - get decision
    const result1 = cellar({
      state,
      player: "human",
      card: "Cellar",
    });

    expect(result1.pendingDecision).toBeDefined();

    // Simulate player discarding 2 Estates
    state.pendingDecision = result1.pendingDecision!;
    const result2 = cellar({
      state,
      player: "human",
      card: "Cellar",
      decision: { selectedCards: ["Estate", "Estate"] },
      stage: "discard",
    });

    // Should create 2 discard events + 2 draw events
    const discardEvents = result2.events.filter(e => e.type === "CARD_DISCARDED");
    const drawEvents = result2.events.filter(e => e.type === "CARD_DRAWN");

    expect(discardEvents.length).toBe(2);
    expect(drawEvents.length).toBe(2);

    // Verify the simulated state used for drawing
    // Should have kept 1 Estate (not removed all 3)
    expect(discardEvents.every(e => e.card === "Estate")).toBe(true);
  });

  it("should handle discarding all copies correctly", () => {
    const state = createTestState();
    state.players.human.hand = ["Estate", "Estate", "Copper"];
    state.players.human.deck = ["Gold", "Gold"];

    const result1 = cellar({
      state,
      player: "human",
      card: "Cellar",
    });

    state.pendingDecision = result1.pendingDecision!;
    const result2 = cellar({
      state,
      player: "human",
      card: "Cellar",
      decision: { selectedCards: ["Estate", "Estate"] },
      stage: "discard",
    });

    const discardEvents = result2.events.filter(e => e.type === "CARD_DISCARDED");
    expect(discardEvents.length).toBe(2);
    expect(discardEvents.every(e => e.card === "Estate")).toBe(true);
  });

  it("should handle discarding mixed cards", () => {
    const state = createTestState();
    state.players.human.hand = ["Estate", "Copper", "Copper", "Silver"];
    state.players.human.deck = ["Gold", "Gold", "Gold"];

    const result1 = cellar({
      state,
      player: "human",
      card: "Cellar",
    });

    state.pendingDecision = result1.pendingDecision!;
    const result2 = cellar({
      state,
      player: "human",
      card: "Cellar",
      decision: { selectedCards: ["Estate", "Copper", "Copper"] },
      stage: "discard",
    });

    const discardEvents = result2.events.filter(e => e.type === "CARD_DISCARDED");
    expect(discardEvents.length).toBe(3);

    const discardedCards = discardEvents.map(e => e.card);
    expect(discardedCards.filter(c => c === "Estate").length).toBe(1);
    expect(discardedCards.filter(c => c === "Copper").length).toBe(2);
  });
});
