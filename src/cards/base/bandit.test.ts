import { describe, it, expect, beforeEach } from "bun:test";
import { bandit } from "./bandit";
import type { GameState } from "../../types/game-state";
import { resetEventCounter } from "../../events/id-generator";
import { applyEvents } from "../../events/apply";

function createTestState(): GameState {
  return {
    playerOrder: ["human", "ai1", "ai2"],
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
      ai1: {
        hand: [],
        deck: [],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
      ai2: {
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

describe("Bandit", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should gain Gold for attacker", () => {
    const state = createTestState();
    state.players["ai1"]!.deck = ["Copper", "Copper"];
    state.players["ai2"]!.deck = ["Copper", "Estate"];

    const result = bandit({
      state,
      playerId: "human",
      card: "Bandit",
    });

    const gainEvents = result.events.filter(e => e.type === "CARD_GAINED");
    expect(gainEvents.length).toBe(1);
    expect(gainEvents[0]?.card).toBe("Gold");
    expect(gainEvents[0]?.playerId).toBe("human");
  });

  it("should auto-discard if opponent has no trashable treasures", () => {
    const state = createTestState();
    // Deck is in reverse order - last element is drawn first
    state.players["ai1"]!.deck = ["Estate", "Copper"];

    const result = bandit({
      state,
      playerId: "human",
      card: "Bandit",
    });

    const revealEvents = result.events.filter(e => e.type === "CARD_REVEALED");
    expect(revealEvents.length).toBe(2);
    // Check that both cards are revealed
    const revealedCards = revealEvents.map(e => e.card).sort();
    expect(revealedCards).toEqual(["Copper", "Estate"]);

    const discardEvents = result.events.filter(e => e.type === "CARD_DISCARDED");
    expect(discardEvents.length).toBe(2);
    expect(result.pendingChoice).toBeUndefined();
  });

  it("should auto-trash if opponent has exactly 1 trashable treasure", () => {
    const state = createTestState();
    state.players["ai1"]!.deck = ["Silver", "Estate"];

    const result = bandit({
      state,
      playerId: "human",
      card: "Bandit",
    });

    const trashEvents = result.events.filter(e => e.type === "CARD_TRASHED");
    expect(trashEvents.length).toBe(1);
    expect(trashEvents[0]?.card).toBe("Silver");
    expect(trashEvents[0]?.playerId).toBe("ai1");

    const discardEvents = result.events.filter(e => e.type === "CARD_DISCARDED");
    expect(discardEvents.length).toBe(1);
    expect(discardEvents[0]?.card).toBe("Estate");
  });

  it("should prompt for choice if opponent has 2 trashable treasures", () => {
    const state = createTestState();
    // Deck is in reverse order - last element is drawn first
    state.players["ai1"]!.deck = ["Gold", "Silver"];

    const result = bandit({
      state,
      playerId: "human",
      card: "Bandit",
    });

    expect(result.pendingChoice).toBeDefined();
    expect(result.pendingChoice?.playerId).toBe("ai1");
    // Check that both treasures are in options
    const options = result.pendingChoice?.cardOptions.sort();
    expect(options).toEqual(["Gold", "Silver"]);
    expect(result.pendingChoice?.min).toBe(1);
    expect(result.pendingChoice?.max).toBe(1);
  });

  it("should handle opponent choice to trash Silver over Gold", () => {
    let state = createTestState();
    state.players["ai1"]!.deck = ["Silver", "Gold"];

    const result1 = bandit({
      state,
      playerId: "human",
      card: "Bandit",
    });

    state = applyEvents(state, result1.events);
    if (result1.pendingChoice) {
      state.pendingChoice = result1.pendingChoice;
    }

    const result2 = bandit({
      state,
      playerId: "human",
      card: "Bandit",
      decision: { selectedCards: ["Silver"] },
      stage: "victim_trash_choice",
    });

    const trashEvents = result2.events.filter(e => e.type === "CARD_TRASHED");
    expect(trashEvents.length).toBe(1);
    expect(trashEvents[0]?.card).toBe("Silver");

    const discardEvents = result2.events.filter(e => e.type === "CARD_DISCARDED");
    expect(discardEvents.length).toBe(1);
    expect(discardEvents[0]?.card).toBe("Gold");
  });

  it("should handle multiple opponents with different scenarios", () => {
    const state = createTestState();
    state.players["ai1"]!.deck = ["Silver", "Estate"]; // Auto-trash Silver
    state.players["ai2"]!.deck = ["Copper", "Copper"]; // Auto-discard both

    const result = bandit({
      state,
      playerId: "human",
      card: "Bandit",
    });

    const trashEvents = result.events.filter(e => e.type === "CARD_TRASHED");
    expect(trashEvents.length).toBe(1);
    expect(trashEvents[0]?.card).toBe("Silver");

    const discardEvents = result.events.filter(e => e.type === "CARD_DISCARDED");
    expect(discardEvents.length).toBe(3); // Estate from ai1, both Coppers from ai2
  });

  it("should handle opponent with empty deck", () => {
    const state = createTestState();
    state.players["ai1"]!.deck = [];

    const result = bandit({
      state,
      playerId: "human",
      card: "Bandit",
    });

    const gainEvents = result.events.filter(e => e.type === "CARD_GAINED");
    expect(gainEvents.length).toBe(1);
    expect(gainEvents[0]?.card).toBe("Gold");

    const revealEvents = result.events.filter(e => e.type === "CARD_REVEALED");
    expect(revealEvents.length).toBe(0);
  });

  it("should handle opponent with only 1 card in deck", () => {
    const state = createTestState();
    state.players["ai1"]!.deck = ["Silver"];

    const result = bandit({
      state,
      playerId: "human",
      card: "Bandit",
    });

    const revealEvents = result.events.filter(e => e.type === "CARD_REVEALED");
    expect(revealEvents.length).toBe(1);

    const trashEvents = result.events.filter(e => e.type === "CARD_TRASHED");
    expect(trashEvents.length).toBe(1);
    expect(trashEvents[0]?.card).toBe("Silver");
  });

  it("should not trash Copper", () => {
    const state = createTestState();
    state.players["ai1"]!.deck = ["Copper", "Copper"];

    const result = bandit({
      state,
      playerId: "human",
      card: "Bandit",
    });

    const trashEvents = result.events.filter(e => e.type === "CARD_TRASHED");
    expect(trashEvents.length).toBe(0);

    const discardEvents = result.events.filter(e => e.type === "CARD_DISCARDED");
    expect(discardEvents.length).toBe(2);
  });

  it("should handle missing opponent", () => {
    const state = createTestState();
    delete state.players["ai1"];

    const result = bandit({
      state,
      playerId: "human",
      card: "Bandit",
    });

    const gainEvents = result.events.filter(e => e.type === "CARD_GAINED");
    expect(gainEvents.length).toBe(1);
  });

  it("should process next opponent after current choice", () => {
    let state = createTestState();
    state.players["ai1"]!.deck = ["Silver", "Gold"]; // Needs choice
    state.players["ai2"]!.deck = ["Silver", "Estate"]; // Auto-trash

    const result1 = bandit({
      state,
      playerId: "human",
      card: "Bandit",
    });

    expect(result1.pendingChoice).toBeDefined();
    expect(result1.pendingChoice?.playerId).toBe("ai1");
    expect(result1.pendingChoice?.metadata?.remainingOpponents).toEqual(["ai2"]);
  });
});
