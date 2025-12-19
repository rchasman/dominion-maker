import { describe, it, expect, beforeEach } from "bun:test";
import { library } from "./library";
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

describe("Library", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should do nothing if already at 7 cards", () => {
    const state = createTestState();
    state.players["human"]!.hand = [
      "Copper",
      "Copper",
      "Copper",
      "Estate",
      "Estate",
      "Estate",
      "Silver",
    ];

    const result = library({
      state,
      playerId: "human",
      card: "Library",
    });

    expect(result.events).toEqual([]);
    expect(result.pendingChoice).toBeUndefined();
  });

  it("should draw cards directly if no actions in deck", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper", "Copper"];
    state.players["human"]!.deck = [
      "Copper",
      "Silver",
      "Gold",
      "Estate",
      "Duchy",
    ];

    const result = library({
      state,
      playerId: "human",
      card: "Library",
    });

    expect(result.events.length).toBe(5);
    expect(result.events.every(e => e.type === "CARD_DRAWN")).toBe(true);
    expect(result.pendingChoice).toBeUndefined();
  });

  it("should prompt for action cards in peek", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper", "Copper"];
    // Deck is in reverse order - last element is drawn first
    state.players["human"]!.deck = [
      "Market",
      "Silver",
      "Smithy",
      "Copper",
      "Village",
    ];

    const result = library({
      state,
      playerId: "human",
      card: "Library",
    });

    expect(result.events).toEqual([]);
    expect(result.pendingChoice).toBeDefined();
    // Actions appear in the order they were peeked
    const actionOptions = result.pendingChoice?.cardOptions.filter((c: any) =>
      ["Village", "Smithy", "Market"].includes(c),
    );
    expect(actionOptions?.length).toBe(3);
    expect(result.pendingChoice?.metadata?.peekedCards).toEqual([
      "Village",
      "Copper",
      "Smithy",
      "Silver",
      "Market",
    ]);
  });

  it("should draw selected actions and discard skipped ones", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper"];
    // Library reads from state.pendingChoice.metadata, not decision
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "human",
      prompt: "Library: Choose which Actions to skip",
      cardOptions: ["Village", "Smithy", "Market"],
      actions: [
        { type: "draw_card", label: "Draw", isDefault: true },
        { type: "discard_card", label: "Discard" },
      ],
      cardBeingPlayed: "Library",
      metadata: { cardsNeeded: 6, peekedCards: ["Village", "Smithy", "Market"] },
    };

    const result = library({
      state,
      playerId: "human",
      card: "Library",
      decision: {
        cardActions: {
          "0": "draw_card", // Draw Village
          "1": "discard_card", // Discard Smithy
          "2": "draw_card", // Draw Market
        },
      },
      stage: "decision" as any, // Any non-undefined stage to process decision
    });

    const drawEvents = result.events.filter(e => e.type === "CARD_DRAWN");
    const discardEvents = result.events.filter(e => e.type === "CARD_DISCARDED");

    expect(drawEvents.length).toBe(2);
    expect(drawEvents.some(e => e.card === "Village")).toBe(true);
    expect(drawEvents.some(e => e.card === "Market")).toBe(true);

    expect(discardEvents.length).toBe(1);
    expect(discardEvents[0]?.card).toBe("Smithy");
    expect(discardEvents[0]?.from).toBe("deck");
  });

  it("should handle all actions being discarded", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper"];
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "human",
      prompt: "Library: Choose which Actions to skip",
      cardOptions: ["Village", "Smithy"],
      actions: [
        { type: "draw_card", label: "Draw", isDefault: true },
        { type: "discard_card", label: "Discard" },
      ],
      cardBeingPlayed: "Library",
      metadata: { cardsNeeded: 6, peekedCards: ["Village", "Smithy"] },
    };

    const result = library({
      state,
      playerId: "human",
      card: "Library",
      decision: {
        cardActions: {
          "0": "discard_card",
          "1": "discard_card",
        },
      },
      stage: "decision" as any, // Any non-undefined stage to process decision
    });

    const discardEvents = result.events.filter(e => e.type === "CARD_DISCARDED");
    expect(discardEvents.length).toBe(2);
    expect(discardEvents.every(e => e.from === "deck")).toBe(true);
  });

  it("should handle all actions being drawn", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper"];
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "human",
      prompt: "Library: Choose which Actions to skip",
      cardOptions: ["Village", "Smithy"],
      actions: [
        { type: "draw_card", label: "Draw", isDefault: true },
        { type: "discard_card", label: "Discard" },
      ],
      cardBeingPlayed: "Library",
      metadata: { cardsNeeded: 6, peekedCards: ["Village", "Smithy"] },
    };

    const result = library({
      state,
      playerId: "human",
      card: "Library",
      decision: {
        cardActions: {
          "0": "draw_card",
          "1": "draw_card",
        },
      },
      stage: "decision" as any, // Any non-undefined stage to process decision
    });

    const drawEvents = result.events.filter(e => e.type === "CARD_DRAWN");
    expect(drawEvents.length).toBe(2);
  });

  it("should handle empty deck gracefully", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper"];
    state.players["human"]!.deck = [];

    const result = library({
      state,
      playerId: "human",
      card: "Library",
    });

    expect(result.events).toEqual([]);
    expect(result.pendingChoice).toBeUndefined();
  });

  it("should handle missing player state", () => {
    const state = createTestState();

    const result = library({
      state,
      playerId: "nonexistent" as any,
      card: "Library",
    });

    expect(result.events).toEqual([]);
  });

  it("should handle decision with invalid indices", () => {
    const state = createTestState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "human",
      prompt: "Library: Choose which Actions to skip",
      cardOptions: ["Village"],
      actions: [
        { type: "draw_card", label: "Draw", isDefault: true },
        { type: "discard_card", label: "Discard" },
      ],
      cardBeingPlayed: "Library",
      metadata: { cardsNeeded: 6, peekedCards: ["Village"] },
    };

    const result = library({
      state,
      playerId: "human",
      card: "Library",
      decision: {
        cardActions: {
          "10": "draw_card", // Out of bounds
        },
      },
    });

    expect(result.events).toEqual([]);
  });
});
