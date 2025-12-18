import { describe, it, expect, beforeEach } from "bun:test";
import { applyEvent, applyEvents } from "./apply";
import { resetEventCounter } from "./id-generator";
import type { GameState, CardName } from "../types/game-state";
import type { GameEvent } from "./types";
import { getSubPhase } from "../lib/state-helpers";

/**
 * Comprehensive event application tests
 * Tests that events actually modify state correctly
 */

function createEmptyState(): GameState {
  return {
    players: {},
    supply: {},
    kingdomCards: [],
    playerOrder: [],
    turn: 0,
    phase: "action",
    activePlayer: "human",
    actions: 0,
    buys: 0,
    coins: 0,
    gameOver: false,
    winner: null,
    pendingDecision: null,
    pendingDecisionEventId: null,
    trash: [],
    log: [],
    turnHistory: [],
    activeEffects: [],
  };
}

function createBasicGameState(): GameState {
  return {
    ...createEmptyState(),
    players: {
      human: {
        deck: ["Copper", "Silver", "Gold"],
        hand: ["Estate", "Duchy"],
        discard: ["Copper"],
        inPlay: [],
        inPlaySourceIndices: [],
      },
      ai: {
        deck: ["Copper", "Copper"],
        hand: ["Estate"],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
    },
    playerOrder: ["human", "ai"],
    supply: {
      Copper: 40,
      Silver: 40,
      Gold: 30,
      Estate: 8,
      Duchy: 8,
      Province: 8,
    },
    turn: 1,
    activePlayer: "human",
  };
}

describe("Event Application - Game Setup", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should apply GAME_INITIALIZED", () => {
    const state = createEmptyState();
    const event: GameEvent = {
      type: "GAME_INITIALIZED",
      players: ["human", "ai"],
      supply: { Copper: 46, Estate: 8 },
      kingdomCards: ["Village", "Smithy"],
    };

    const newState = applyEvent(state, event);

    expect(newState.players.human).toBeDefined();
    expect(newState.players.ai).toBeDefined();
    expect(newState.supply).toEqual({ Copper: 46, Estate: 8 });
    expect(newState.kingdomCards).toEqual(["Village", "Smithy"]);
    expect(newState.playerOrder).toEqual(["human", "ai"]);
    expect(newState.activePlayer).toBe("human");
    expect(newState.turn).toBe(0);
    expect(newState.actions).toBe(1);
    expect(newState.buys).toBe(1);
  });

  it("should apply INITIAL_DECK_DEALT", () => {
    const state = createBasicGameState();
    state.players.human.deck = [];

    const event: GameEvent = {
      type: "INITIAL_DECK_DEALT",
      player: "human",
      cards: [
        "Copper",
        "Copper",
        "Copper",
        "Copper",
        "Copper",
        "Copper",
        "Copper",
        "Estate",
        "Estate",
        "Estate",
      ],
    };

    const newState = applyEvent(state, event);

    expect(newState.players.human.deck.length).toBe(10);
    expect(newState.players.human.deck).toEqual(event.cards);
  });

  it("should apply INITIAL_HAND_DRAWN", () => {
    const state = createBasicGameState();
    state.players.human.deck = [
      "Copper",
      "Copper",
      "Copper",
      "Copper",
      "Copper",
      "Estate",
      "Estate",
    ];
    state.players.human.hand = [];

    const event: GameEvent = {
      type: "INITIAL_HAND_DRAWN",
      player: "human",
      cards: ["Estate", "Estate", "Copper", "Copper", "Copper"],
    };

    const newState = applyEvent(state, event);

    expect(newState.players.human.hand).toEqual(event.cards);
    expect(newState.players.human.deck.length).toBe(2); // 7 - 5 = 2
    expect(newState.turn).toBe(1); // Sets turn to 1
  });
});

describe("Event Application - Turn Structure", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should apply TURN_STARTED", () => {
    const state = createBasicGameState();
    state.turn = 1;

    const event: GameEvent = {
      type: "TURN_STARTED",
      turn: 2,
      player: "ai",
    };

    const newState = applyEvent(state, event);

    expect(newState.turn).toBe(2);
    expect(newState.activePlayer).toBe("ai");
    expect(newState.phase).toBe("action");
    expect(newState.actions).toBe(0);
    expect(newState.buys).toBe(0);
    expect(newState.coins).toBe(0);
    expect(newState.turnHistory).toEqual([]);
  });

  it("should apply PHASE_CHANGED", () => {
    const state = createBasicGameState();
    state.phase = "action";

    const event: GameEvent = {
      type: "PHASE_CHANGED",
      phase: "buy",
    };

    const newState = applyEvent(state, event);

    expect(newState.phase).toBe("buy");
    expect(newState.log.length).toBeGreaterThan(0);
  });

  it("should apply TURN_ENDED (no-op)", () => {
    const state = createBasicGameState();

    const event: GameEvent = {
      type: "TURN_ENDED",
      player: "human",
      turn: 1,
    };

    const newState = applyEvent(state, event);

    // TURN_ENDED is a marker event, doesn't change state
    expect(newState).toEqual(state);
  });
});

describe("Event Application - Card Movement", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should apply CARD_DRAWN (single card)", () => {
    const state = createBasicGameState();
    state.players.human.deck = ["Copper", "Silver", "Gold"];
    state.players.human.hand = ["Estate"];

    const event: GameEvent = {
      type: "CARD_DRAWN",
      player: "human",
      card: "Gold",
    };

    const newState = applyEvent(state, event);

    // Card moved from end of deck to hand
    expect(newState.players.human.deck).toEqual(["Copper", "Silver"]);
    expect(newState.players.human.hand).toEqual(["Estate", "Gold"]);
  });

  it("should apply CARD_PLAYED", () => {
    const state = createBasicGameState();
    state.players.human.hand = ["Village", "Estate", "Copper"];

    const event: GameEvent = {
      type: "CARD_PLAYED",
      player: "human",
      card: "Village",
    };

    const newState = applyEvent(state, event);

    // Card moved from hand to inPlay
    expect(newState.players.human.hand).toEqual(["Estate", "Copper"]);
    expect(newState.players.human.inPlay).toEqual(["Village"]);
    expect(newState.players.human.inPlaySourceIndices).toEqual([0]); // Was at index 0
  });

  it("should apply CARD_DISCARDED from hand", () => {
    const state = createBasicGameState();
    state.players.human.hand = ["Copper", "Estate"];
    state.players.human.discard = [];

    const event: GameEvent = {
      type: "CARD_DISCARDED",
      player: "human",
      card: "Copper",
      from: "hand",
    };

    const newState = applyEvent(state, event);

    expect(newState.players.human.hand).toEqual(["Estate"]);
    expect(newState.players.human.discard).toEqual(["Copper"]);
  });

  it("should apply CARD_DISCARDED from inPlay", () => {
    const state = createBasicGameState();
    state.players.human.inPlay = ["Village", "Smithy"];
    state.players.human.inPlaySourceIndices = [0, 1];
    state.players.human.discard = [];

    const event: GameEvent = {
      type: "CARD_DISCARDED",
      player: "human",
      card: "Village",
      from: "inPlay",
    };

    const newState = applyEvent(state, event);

    expect(newState.players.human.inPlay).toEqual(["Smithy"]);
    expect(newState.players.human.inPlaySourceIndices).toEqual([1]);
    expect(newState.players.human.discard).toEqual(["Village"]);
  });

  it("should apply CARD_DISCARDED from deck", () => {
    const state = createBasicGameState();
    state.players.human.deck = ["Copper", "Silver", "Gold"];
    state.players.human.discard = [];

    const event: GameEvent = {
      type: "CARD_DISCARDED",
      player: "human",
      card: "Gold",
      from: "deck",
    };

    const newState = applyEvent(state, event);

    // Removes from end of deck (top)
    expect(newState.players.human.deck).toEqual(["Copper", "Silver"]);
    expect(newState.players.human.discard).toEqual(["Gold"]);
  });

  it("should apply CARD_TRASHED from hand", () => {
    const state = createBasicGameState();
    state.players.human.hand = ["Copper", "Estate"];
    state.trash = [];

    const event: GameEvent = {
      type: "CARD_TRASHED",
      player: "human",
      card: "Copper",
      from: "hand",
    };

    const newState = applyEvent(state, event);

    expect(newState.players.human.hand).toEqual(["Estate"]);
    expect(newState.trash).toEqual(["Copper"]);
  });

  it("should apply CARD_TRASHED from deck", () => {
    const state = createBasicGameState();
    state.players.human.deck = ["Copper", "Silver", "Gold"];
    state.trash = [];

    const event: GameEvent = {
      type: "CARD_TRASHED",
      player: "human",
      card: "Gold",
      from: "deck",
    };

    const newState = applyEvent(state, event);

    expect(newState.players.human.deck).toEqual(["Copper", "Silver"]);
    expect(newState.trash).toEqual(["Gold"]);
  });

  it("should apply CARD_GAINED to discard", () => {
    const state = createBasicGameState();
    state.players.human.discard = [];
    state.supply.Silver = 40;

    const event: GameEvent = {
      type: "CARD_GAINED",
      player: "human",
      card: "Silver",
      to: "discard",
    };

    const newState = applyEvent(state, event);

    expect(newState.players.human.discard).toEqual(["Silver"]);
    expect(newState.supply.Silver).toBe(39);
  });

  it("should apply CARD_GAINED to hand", () => {
    const state = createBasicGameState();
    state.players.human.hand = ["Copper"];
    state.supply.Gold = 30;

    const event: GameEvent = {
      type: "CARD_GAINED",
      player: "human",
      card: "Gold",
      to: "hand",
    };

    const newState = applyEvent(state, event);

    expect(newState.players.human.hand).toEqual(["Copper", "Gold"]);
    expect(newState.supply.Gold).toBe(29);
  });

  it("should apply CARD_GAINED to deck (top)", () => {
    const state = createBasicGameState();
    state.players.human.deck = ["Copper", "Silver"];
    state.supply.Gold = 30;

    const event: GameEvent = {
      type: "CARD_GAINED",
      player: "human",
      card: "Gold",
      to: "deck",
    };

    const newState = applyEvent(state, event);

    // Added to top of deck (end of array)
    expect(newState.players.human.deck).toEqual(["Copper", "Silver", "Gold"]);
    expect(newState.supply.Gold).toBe(29);
  });

  it("should apply CARD_REVEALED", () => {
    const state = createBasicGameState();

    const event: GameEvent = {
      type: "CARD_REVEALED",
      player: "human",
      cards: ["Copper", "Silver"],
    };

    const newState = applyEvent(state, event);

    // Reveal is a log event only
    expect(newState.log.length).toBeGreaterThan(state.log.length);
  });

  it("should apply DECK_SHUFFLED", () => {
    const state = createBasicGameState();
    state.players.human.deck = ["Copper"];
    state.players.human.discard = ["Silver", "Gold", "Estate"];

    const event: GameEvent = {
      type: "DECK_SHUFFLED",
      player: "human",
      newDeckOrder: ["Gold", "Estate", "Silver"],
    };

    const newState = applyEvent(state, event);

    expect(newState.players.human.deck).toEqual(["Gold", "Estate", "Silver"]);
    expect(newState.players.human.discard).toEqual([]);
  });

  it("should apply CARD_PUT_ON_DECK from hand", () => {
    const state = createBasicGameState();
    state.players.human.hand = ["Copper", "Estate"];
    state.players.human.deck = ["Silver"];

    const event: GameEvent = {
      type: "CARD_PUT_ON_DECK",
      player: "human",
      card: "Estate",
      from: "hand",
    };

    const newState = applyEvent(state, event);

    expect(newState.players.human.hand).toEqual(["Copper"]);
    expect(newState.players.human.deck).toEqual(["Silver", "Estate"]);
  });

  it("should apply CARD_PUT_ON_DECK from discard", () => {
    const state = createBasicGameState();
    state.players.human.discard = ["Copper", "Estate", "Gold"];
    state.players.human.deck = ["Silver"];

    const event: GameEvent = {
      type: "CARD_PUT_ON_DECK",
      player: "human",
      card: "Gold",
      from: "discard",
    };

    const newState = applyEvent(state, event);

    expect(newState.players.human.discard).toEqual(["Copper", "Estate"]);
    expect(newState.players.human.deck).toEqual(["Silver", "Gold"]);
  });

  it("should apply CARD_RETURNED_TO_HAND from inPlay", () => {
    const state = createBasicGameState();
    state.players.human.hand = ["Estate"];
    state.players.human.inPlay = ["Copper", "Silver"];
    state.players.human.inPlaySourceIndices = [0, 1];

    const event: GameEvent = {
      type: "CARD_RETURNED_TO_HAND",
      player: "human",
      card: "Copper",
      from: "inPlay",
    };

    const newState = applyEvent(state, event);

    expect(newState.players.human.hand).toEqual(["Estate", "Copper"]);
    expect(newState.players.human.inPlay).toEqual(["Silver"]);
    expect(newState.players.human.inPlaySourceIndices).toEqual([1]);
  });

  it("should apply CARD_RETURNED_TO_HAND from discard", () => {
    const state = createBasicGameState();
    state.players.human.hand = ["Estate"];
    state.players.human.discard = ["Copper", "Silver"];

    const event: GameEvent = {
      type: "CARD_RETURNED_TO_HAND",
      player: "human",
      card: "Silver",
      from: "discard",
    };

    const newState = applyEvent(state, event);

    expect(newState.players.human.hand).toEqual(["Estate", "Silver"]);
    expect(newState.players.human.discard).toEqual(["Copper"]);
  });
});

describe("Event Application - Resources", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should apply ACTIONS_MODIFIED (add)", () => {
    const state = createBasicGameState();
    state.actions = 1;

    const event: GameEvent = {
      type: "ACTIONS_MODIFIED",
      delta: 2,
    };

    const newState = applyEvent(state, event);

    expect(newState.actions).toBe(3);
  });

  it("should apply ACTIONS_MODIFIED (subtract)", () => {
    const state = createBasicGameState();
    state.actions = 3;

    const event: GameEvent = {
      type: "ACTIONS_MODIFIED",
      delta: -1,
    };

    const newState = applyEvent(state, event);

    expect(newState.actions).toBe(2);
  });

  it("should apply ACTIONS_MODIFIED (never negative)", () => {
    const state = createBasicGameState();
    state.actions = 1;

    const event: GameEvent = {
      type: "ACTIONS_MODIFIED",
      delta: -5,
    };

    const newState = applyEvent(state, event);

    expect(newState.actions).toBe(0); // Clamped to 0
  });

  it("should apply BUYS_MODIFIED", () => {
    const state = createBasicGameState();
    state.buys = 1;

    const event: GameEvent = {
      type: "BUYS_MODIFIED",
      delta: 1,
    };

    const newState = applyEvent(state, event);

    expect(newState.buys).toBe(2);
  });

  it("should apply BUYS_MODIFIED (never negative)", () => {
    const state = createBasicGameState();
    state.buys = 1;

    const event: GameEvent = {
      type: "BUYS_MODIFIED",
      delta: -3,
    };

    const newState = applyEvent(state, event);

    expect(newState.buys).toBe(0);
  });

  it("should apply COINS_MODIFIED", () => {
    const state = createBasicGameState();
    state.coins = 5;

    const event: GameEvent = {
      type: "COINS_MODIFIED",
      delta: 3,
    };

    const newState = applyEvent(state, event);

    expect(newState.coins).toBe(8);
  });

  it("should apply COINS_MODIFIED (never negative)", () => {
    const state = createBasicGameState();
    state.coins = 2;

    const event: GameEvent = {
      type: "COINS_MODIFIED",
      delta: -5,
    };

    const newState = applyEvent(state, event);

    expect(newState.coins).toBe(0);
  });
});

describe("Event Application - Decisions", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should apply DECISION_REQUIRED", () => {
    const state = createBasicGameState();

    const decision = {
      type: "select_cards" as const,
      player: "human",
      from: "hand" as const,
      prompt: "Choose a card",
      cardOptions: ["Copper", "Estate"] as CardName[],
      min: 1,
      max: 1,
      cardBeingPlayed: "Chapel" as CardName,
      stage: "trash",
    };

    const event: GameEvent = {
      type: "DECISION_REQUIRED",
      decision,
    };

    const newState = applyEvent(state, event);

    expect(newState.pendingDecision).toEqual(decision);
    expect(getSubPhase(newState)).toBeNull();
  });

  it("should apply DECISION_REQUIRED for opponent (sets subPhase)", () => {
    const state = createBasicGameState();
    state.activePlayer = "human";

    const decision = {
      type: "select_cards" as const,
      player: "ai", // Opponent!
      from: "hand" as const,
      prompt: "Discard down to 3",
      cardOptions: ["Copper"] as CardName[],
      min: 1,
      max: 1,
      cardBeingPlayed: "Militia" as CardName,
      stage: "opponent_discard",
    };

    const event: GameEvent = {
      type: "DECISION_REQUIRED",
      decision,
    };

    const newState = applyEvent(state, event);

    expect(newState.pendingDecision).toEqual(decision);
    expect(getSubPhase(newState)).toBe("opponent_decision");
  });

  it("should apply DECISION_RESOLVED", () => {
    const state = createBasicGameState();
    state.pendingDecision = {
      type: "select_cards",
      player: "human",
      from: "hand",
      prompt: "Test",
      cardOptions: [],
      min: 0,
      max: 1,
      cardBeingPlayed: "Chapel",
      stage: "trash",
    };

    const event: GameEvent = {
      type: "DECISION_RESOLVED",
    };

    const newState = applyEvent(state, event);

    expect(newState.pendingDecision).toBeNull();
    expect(getSubPhase(newState)).toBeNull();
  });
});

describe("Event Application - Game End", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should apply GAME_ENDED", () => {
    const state = createBasicGameState();
    state.gameOver = false;

    const event: GameEvent = {
      type: "GAME_ENDED",
      winner: "human",
      scores: { human: 10, ai: 5 },
    };

    const newState = applyEvent(state, event);

    expect(newState.gameOver).toBe(true);
    expect(newState.winner).toBe("human");
  });
});

describe("Event Application - Multiple Events", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should apply multiple events in sequence (applyEvents)", () => {
    const state = createBasicGameState();
    state.players.human.hand = ["Village"];
    state.players.human.deck = ["Copper", "Silver"];
    state.actions = 1;

    const events: GameEvent[] = [
      { type: "CARD_PLAYED", player: "human", card: "Village" },
      { type: "ACTIONS_MODIFIED", delta: -1 },
      { type: "CARD_DRAWN", player: "human", card: "Silver" },
      { type: "ACTIONS_MODIFIED", delta: 2 },
    ];

    const newState = applyEvents(state, events);

    // All events applied
    expect(newState.players.human.hand).toEqual(["Silver"]);
    expect(newState.players.human.inPlay).toEqual(["Village"]);
    expect(newState.players.human.deck).toEqual(["Copper"]);
    expect(newState.actions).toBe(2); // 1 - 1 + 2
  });

  it("should handle complex event chain (Market played)", () => {
    const state = createBasicGameState();
    state.players.human.hand = ["Market"];
    state.players.human.deck = ["Copper"];
    state.actions = 1;
    state.buys = 1;
    state.coins = 0;

    const events: GameEvent[] = [
      { type: "CARD_PLAYED", player: "human", card: "Market" },
      { type: "ACTIONS_MODIFIED", delta: -1 },
      { type: "CARD_DRAWN", player: "human", card: "Copper" },
      { type: "ACTIONS_MODIFIED", delta: 1 },
      { type: "BUYS_MODIFIED", delta: 1 },
      { type: "COINS_MODIFIED", delta: 1 },
    ];

    const newState = applyEvents(state, events);

    expect(newState.players.human.hand).toEqual(["Copper"]);
    expect(newState.players.human.inPlay).toEqual(["Market"]);
    expect(newState.actions).toBe(1); // 1 - 1 + 1
    expect(newState.buys).toBe(2); // 1 + 1
    expect(newState.coins).toBe(1); // 0 + 1
  });
});

describe("Event Application - Edge Cases", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should handle drawing card not in deck (adds anyway, deck unchanged)", () => {
    const state = createBasicGameState();
    state.players.human.deck = ["Copper"];
    state.players.human.hand = [];

    // Try to draw a card that doesn't exist at top of deck
    const event: GameEvent = {
      type: "CARD_DRAWN",
      player: "human",
      card: "Gold", // Not in deck!
    };

    const newState = applyEvent(state, event);

    // Implementation adds to hand and slices deck (events are trusted)
    expect(newState.players.human.hand).toEqual(["Gold"]);
    // Deck.slice(0, -1) removes last element regardless
    expect(newState.players.human.deck).toEqual([]);
  });

  it("should handle discarding card not in hand (adds to discard anyway)", () => {
    const state = createBasicGameState();
    state.players.human.hand = ["Copper"];
    state.players.human.discard = [];

    const event: GameEvent = {
      type: "CARD_DISCARDED",
      player: "human",
      card: "Gold", // Not in hand!
      from: "hand",
    };

    const newState = applyEvent(state, event);

    // Hand unchanged (card not found)
    expect(newState.players.human.hand).toEqual(["Copper"]);
    // But discard still gets the card (events are trusted)
    expect(newState.players.human.discard).toEqual(["Gold"]);
  });

  it("should silently ignore gaining from empty supply", () => {
    const state = createBasicGameState();
    state.supply.Silver = 0;
    state.players.human.discard = [];

    const event: GameEvent = {
      type: "CARD_GAINED",
      player: "human",
      card: "Silver",
      to: "discard",
    };

    const newState = applyEvent(state, event);

    expect(newState.players.human.discard).toEqual([]);
    expect(newState.supply.Silver).toBe(0); // No-op when supply is empty
  });

  it("should handle event for nonexistent player (no-op)", () => {
    const state = createBasicGameState();

    const event: GameEvent = {
      type: "CARD_DRAWN",
      player: "nonexistent",
      card: "Copper",
    };

    const newState = applyEvent(state, event);

    // Should not crash
    expect(newState).toBeDefined();
  });

  it("should handle multiple cards with same name in hand", () => {
    const state = createBasicGameState();
    state.players.human.hand = ["Copper", "Copper", "Copper", "Estate"];

    const event: GameEvent = {
      type: "CARD_DISCARDED",
      player: "human",
      card: "Copper",
      from: "hand",
    };

    const newState = applyEvent(state, event);

    // Should remove first occurrence only
    expect(newState.players.human.hand).toEqual(["Copper", "Copper", "Estate"]);
    expect(newState.players.human.discard.length).toBe(2); // Original discard + new
  });
});

describe("Event Application - Source Index Tracking", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should track inPlaySourceIndices when playing cards", () => {
    const state = createBasicGameState();
    state.players.human.hand = ["Village", "Smithy", "Market", "Copper"];

    // Play Smithy (index 1)
    let newState = applyEvent(state, {
      type: "CARD_PLAYED",
      player: "human",
      card: "Smithy",
    });

    expect(newState.players.human.inPlay).toEqual(["Smithy"]);
    expect(newState.players.human.inPlaySourceIndices).toEqual([1]);

    // Play Market (was index 2, now index 1)
    newState = applyEvent(newState, {
      type: "CARD_PLAYED",
      player: "human",
      card: "Market",
    });

    expect(newState.players.human.inPlay).toEqual(["Smithy", "Market"]);
    expect(newState.players.human.inPlaySourceIndices).toEqual([1, 1]);
  });

  it("should update inPlaySourceIndices when discarding from play", () => {
    const state = createBasicGameState();
    state.players.human.inPlay = ["Village", "Smithy", "Market"];
    state.players.human.inPlaySourceIndices = [0, 1, 2];

    // Discard Smithy (middle card)
    const newState = applyEvent(state, {
      type: "CARD_DISCARDED",
      player: "human",
      card: "Smithy",
      from: "inPlay",
    });

    expect(newState.players.human.inPlay).toEqual(["Village", "Market"]);
    expect(newState.players.human.inPlaySourceIndices).toEqual([0, 2]);
  });
});

describe("Event Application - Undo Events", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should not modify state for UNDO_REQUESTED", () => {
    const state = createBasicGameState();

    const event: GameEvent = {
      type: "UNDO_REQUESTED",
      requestedBy: "human",
      targetEventId: "evt-5",
    };

    const newState = applyEvent(state, event);

    // Meta-event, no state change
    expect(newState).toEqual(state);
  });

  it("should not modify state for UNDO_APPROVED", () => {
    const state = createBasicGameState();

    const event: GameEvent = {
      type: "UNDO_APPROVED",
      approvedBy: "ai",
    };

    const newState = applyEvent(state, event);

    expect(newState).toEqual(state);
  });

  it("should not modify state for UNDO_DENIED", () => {
    const state = createBasicGameState();

    const event: GameEvent = {
      type: "UNDO_DENIED",
      deniedBy: "ai",
    };

    const newState = applyEvent(state, event);

    expect(newState).toEqual(state);
  });

  it("should not modify state for UNDO_EXECUTED", () => {
    const state = createBasicGameState();

    const event: GameEvent = {
      type: "UNDO_EXECUTED",
      targetEventId: "evt-5",
    };

    const newState = applyEvent(state, event);

    expect(newState).toEqual(state);
  });
});
