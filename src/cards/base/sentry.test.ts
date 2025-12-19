import { describe, it, expect, beforeEach } from "bun:test";
import { sentry } from "./sentry";
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

describe("Sentry", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should grant +1 Card and +1 Action with empty deck", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper"];
    state.players["human"]!.deck = [];

    const result = sentry({
      state,
      playerId: "human",
      card: "Sentry",
    });

    expect(result.events).toContainEqual({ type: "ACTIONS_MODIFIED", delta: 1 });
    expect(result.pendingChoice).toBeUndefined();
  });

  it("should peek at top 2 cards and prompt for actions", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper"];
    // Deck is in reverse order - last element is drawn first
    state.players["human"]!.deck = ["Silver", "Estate", "Gold"];

    const result = sentry({
      state,
      playerId: "human",
      card: "Sentry",
    });

    expect(result.events).toContainEqual({ type: "ACTIONS_MODIFIED", delta: 1 });
    const peekEvents = result.events.filter(e => e.type === "CARD_PEEKED");
    expect(peekEvents.length).toBe(2);
    // Check that both cards were peeked
    const peekedCards = peekEvents.map(e => e.card).sort();
    expect(peekedCards).toEqual(["Estate", "Gold"]);

    expect(result.pendingChoice).toBeDefined();
    expect(result.pendingChoice?.cardOptions.length).toBe(2);
    expect(result.pendingChoice?.requiresOrdering).toBe(true);
  });

  it("should trash selected cards", () => {
    const state = createTestState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "human",
      prompt: "Sentry: Choose what to do with each card",
      cardOptions: ["Estate", "Copper"],
      actions: [
        { type: "topdeck_card", label: "Topdeck", isDefault: true },
        { type: "trash_card", label: "Trash" },
        { type: "discard_card", label: "Discard" },
      ],
      requiresOrdering: true,
      orderingPrompt: "Cards to topdeck will return in this order (first = top)",
      cardBeingPlayed: "Sentry",
      metadata: { revealedCards: ["Estate", "Copper"] },
    };

    const result = sentry({
      state,
      playerId: "human",
      card: "Sentry",
      decision: {
        cardActions: {
          "0": "trash_card",
          "1": "trash_card",
        },
      },
    });

    const trashEvents = result.events.filter(e => e.type === "CARD_TRASHED");
    expect(trashEvents.length).toBe(2);
    expect(trashEvents[0]?.card).toBe("Estate");
    expect(trashEvents[1]?.card).toBe("Copper");
    expect(trashEvents.every(e => e.from === "deck")).toBe(true);
  });

  it("should discard selected cards", () => {
    const state = createTestState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "human",
      prompt: "Sentry: Choose what to do with each card",
      cardOptions: ["Estate", "Copper"],
      actions: [
        { type: "topdeck_card", label: "Topdeck", isDefault: true },
        { type: "trash_card", label: "Trash" },
        { type: "discard_card", label: "Discard" },
      ],
      requiresOrdering: true,
      orderingPrompt: "Cards to topdeck will return in this order (first = top)",
      cardBeingPlayed: "Sentry",
      metadata: { revealedCards: ["Estate", "Copper"] },
    };

    const result = sentry({
      state,
      playerId: "human",
      card: "Sentry",
      decision: {
        cardActions: {
          "0": "discard_card",
          "1": "discard_card",
        },
      },
    });

    const discardEvents = result.events.filter(e => e.type === "CARD_DISCARDED");
    expect(discardEvents.length).toBe(2);
    expect(discardEvents[0]?.card).toBe("Estate");
    expect(discardEvents[1]?.card).toBe("Copper");
  });

  it("should topdeck cards in specified order", () => {
    const state = createTestState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "human",
      prompt: "Sentry: Choose what to do with each card",
      cardOptions: ["Estate", "Silver"],
      actions: [
        { type: "topdeck_card", label: "Topdeck", isDefault: true },
        { type: "trash_card", label: "Trash" },
        { type: "discard_card", label: "Discard" },
      ],
      requiresOrdering: true,
      orderingPrompt: "Cards to topdeck will return in this order (first = top)",
      cardBeingPlayed: "Sentry",
      metadata: { revealedCards: ["Estate", "Silver"] },
    };

    const result = sentry({
      state,
      playerId: "human",
      card: "Sentry",
      decision: {
        cardActions: {
          "0": "topdeck_card",
          "1": "topdeck_card",
        },
        cardOrder: [1, 0], // Silver first, then Estate
      },
    });

    const topdeckEvents = result.events.filter(
      e => e.type === "CARD_PUT_ON_DECK",
    );
    expect(topdeckEvents.length).toBe(2);
    // Reversed because they're put on deck in reverse order
    expect(topdeckEvents[0]?.card).toBe("Estate");
    expect(topdeckEvents[1]?.card).toBe("Silver");
  });

  it("should handle mixed actions: trash, discard, topdeck", () => {
    const state = createTestState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "human",
      prompt: "Sentry: Choose what to do with each card",
      cardOptions: ["Estate", "Copper"],
      actions: [
        { type: "topdeck_card", label: "Topdeck", isDefault: true },
        { type: "trash_card", label: "Trash" },
        { type: "discard_card", label: "Discard" },
      ],
      requiresOrdering: true,
      orderingPrompt: "Cards to topdeck will return in this order (first = top)",
      cardBeingPlayed: "Sentry",
      metadata: { revealedCards: ["Estate", "Copper"] },
    };

    const result = sentry({
      state,
      playerId: "human",
      card: "Sentry",
      decision: {
        cardActions: {
          "0": "trash_card",
          "1": "topdeck_card",
        },
      },
    });

    expect(result.events).toContainEqual({
      type: "CARD_TRASHED",
      playerId: "human",
      card: "Estate",
      from: "deck",
    });
    expect(result.events).toContainEqual({
      type: "CARD_PUT_ON_DECK",
      playerId: "human",
      card: "Copper",
      from: "hand",
    });
  });

  it("should handle topdeck with no explicit order", () => {
    const state = createTestState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "human",
      prompt: "Sentry: Choose what to do with each card",
      cardOptions: ["Estate", "Silver"],
      actions: [
        { type: "topdeck_card", label: "Topdeck", isDefault: true },
        { type: "trash_card", label: "Trash" },
        { type: "discard_card", label: "Discard" },
      ],
      requiresOrdering: true,
      orderingPrompt: "Cards to topdeck will return in this order (first = top)",
      cardBeingPlayed: "Sentry",
      metadata: { revealedCards: ["Estate", "Silver"] },
    };

    const result = sentry({
      state,
      playerId: "human",
      card: "Sentry",
      decision: {
        cardActions: {
          "0": "topdeck_card",
          "1": "topdeck_card",
        },
        cardOrder: [],
      },
    });

    const topdeckEvents = result.events.filter(
      e => e.type === "CARD_PUT_ON_DECK",
    );
    expect(topdeckEvents.length).toBe(2);
  });

  it("should handle only 1 card in deck", () => {
    const state = createTestState();
    state.players["human"]!.hand = ["Copper"];
    state.players["human"]!.deck = ["Estate"];

    const result = sentry({
      state,
      playerId: "human",
      card: "Sentry",
    });

    const peekEvents = result.events.filter(e => e.type === "CARD_PEEKED");
    expect(peekEvents.length).toBe(1);
    expect(result.pendingChoice?.cardOptions).toEqual(["Estate"]);
  });

  it("should handle missing player state", () => {
    const state = createTestState();

    const result = sentry({
      state,
      playerId: "nonexistent" as any,
      card: "Sentry",
    });

    expect(result.events).toEqual([]);
  });

  it("should handle invalid card indices in decision", () => {
    const state = createTestState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "human",
      prompt: "Sentry: Choose what to do with each card",
      cardOptions: ["Estate"],
      actions: [
        { type: "topdeck_card", label: "Topdeck", isDefault: true },
        { type: "trash_card", label: "Trash" },
        { type: "discard_card", label: "Discard" },
      ],
      requiresOrdering: true,
      orderingPrompt: "Cards to topdeck will return in this order (first = top)",
      cardBeingPlayed: "Sentry",
      metadata: { revealedCards: ["Estate"] },
    };

    const result = sentry({
      state,
      playerId: "human",
      card: "Sentry",
      decision: {
        cardActions: {
          "5": "trash_card", // Out of bounds
        },
      },
    });

    expect(result.events).toEqual([]);
  });
});
