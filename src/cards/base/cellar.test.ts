import { describe, it, expect, beforeEach } from "bun:test";
import { cellar } from "./cellar";
import type { GameState } from "../../types/game-state";
import { resetEventCounter } from "../../events/id-generator";
import { applyEvents } from "../../events/apply";

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
    turnHistory: [],
    kingdomCards: [],
    pendingDecision: null,
    pendingDecisionEventId: null,
    subPhase: null,
    gameOver: false,
    winner: null,
    activeEffects: [],
  };
}

describe("Cellar - duplicate card handling", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should discard cards one at a time and draw at the end", () => {
    const state = createTestState();
    // Player has 3 Estates, wants to discard 2
    state.players.human.hand = [
      "Estate",
      "Estate",
      "Estate",
      "Copper",
      "Silver",
    ];
    state.players.human.deck = ["Gold", "Gold", "Gold"]; // Cards to draw

    // Initial call - get decision
    const result1 = cellar({
      state,
      player: "human",
      card: "Cellar",
    });

    expect(result1.pendingDecision).toBeDefined();
    expect(result1.pendingDecision?.min).toBe(0);
    expect(result1.pendingDecision?.max).toBe(1);

    // First discard: Estate
    if (result1.pendingDecision) {
      state.pendingDecision = result1.pendingDecision;
    }
    const result2 = cellar({
      state,
      player: "human",
      card: "Cellar",
      decision: { selectedCards: ["Estate"] },
      stage: "discard",
    });

    expect(result2.events.filter(e => e.type === "CARD_DISCARDED").length).toBe(
      1,
    );
    expect(result2.pendingDecision).toBeDefined(); // Should continue

    // Second discard: Estate
    if (result2.pendingDecision) {
      state.pendingDecision = result2.pendingDecision;
    }
    const result3 = cellar({
      state,
      player: "human",
      card: "Cellar",
      decision: { selectedCards: ["Estate"] },
      stage: "discard",
    });

    expect(result3.events.filter(e => e.type === "CARD_DISCARDED").length).toBe(
      1,
    );
    expect(result3.pendingDecision).toBeDefined(); // Should continue

    // Skip to finish - use on_skip stage
    if (result3.pendingDecision) {
      state.pendingDecision = result3.pendingDecision;
    }
    const result4 = cellar({
      state,
      player: "human",
      card: "Cellar",
      decision: { selectedCards: [] },
      stage: "on_skip",
    });

    const drawEvents = result4.events.filter(e => e.type === "CARD_DRAWN");
    expect(drawEvents.length).toBe(2); // Drew 2 because discarded 2
  });

  it("should handle skipping immediately (discard zero)", () => {
    const state = createTestState();
    state.players.human.hand = ["Estate", "Estate", "Copper"];
    state.players.human.deck = ["Gold", "Gold"];

    const result1 = cellar({
      state,
      player: "human",
      card: "Cellar",
    });

    if (result1.pendingDecision) {
      state.pendingDecision = result1.pendingDecision;
    }

    // Skip immediately without discarding - use on_skip stage
    const result2 = cellar({
      state,
      player: "human",
      card: "Cellar",
      decision: { selectedCards: [] },
      stage: "on_skip",
    });

    // Should have no events (no discards, no draws)
    expect(result2.events.length).toBe(0);
  });

  it("should handle discarding until hand is empty", () => {
    let state = createTestState();
    state.players.human.hand = ["Estate", "Copper"];
    state.players.human.deck = ["Gold", "Gold"];

    const result1 = cellar({
      state,
      player: "human",
      card: "Cellar",
    });

    // Apply initial events and update state
    state = applyEvents(state, result1.events);
    if (result1.pendingDecision) {
      state.pendingDecision = result1.pendingDecision;
    }

    // First discard: Estate
    const result2 = cellar({
      state,
      player: "human",
      card: "Cellar",
      decision: { selectedCards: ["Estate"] },
      stage: "discard",
    });

    expect(result2.pendingDecision).toBeDefined();

    // Apply discard event and update state
    state = applyEvents(state, result2.events);
    if (result2.pendingDecision) {
      state.pendingDecision = result2.pendingDecision;
    }

    // Second discard: Copper (last card in hand)
    const result3 = cellar({
      state,
      player: "human",
      card: "Cellar",
      decision: { selectedCards: ["Copper"] },
      stage: "discard",
    });

    // Should auto-draw when hand is empty (no more decisions)
    expect(result3.pendingDecision).toBeUndefined();
    const discardEvents = result3.events.filter(
      e => e.type === "CARD_DISCARDED",
    );
    const drawEvents = result3.events.filter(e => e.type === "CARD_DRAWN");
    expect(discardEvents.length).toBe(1); // Just this discard
    expect(drawEvents.length).toBe(2); // Drew 2 (total discarded)
  });
});
