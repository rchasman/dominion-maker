import { describe, it, expect, beforeEach } from "bun:test";
import {
  peekDraw,
  createDrawEvents,
  getGainableCards,
  getGainableTreasures,
  getOpponents,
  createSimpleCardEffect,
  isActionCard,
  isTreasureCard,
  isVictoryCard,
  isInitialCall,
  createCardSelectionDecision,
} from "./effect-types";
import { resetEventCounter } from "../events/id-generator";
import type { GameState, PlayerState, CardName } from "../types/game-state";

/**
 * Helper function tests for effect-types.ts
 * Tests the foundation that all card effects depend on
 */

function createBasicState(): GameState {
  return {
    players: {
      human: {
        deck: [],
        hand: [],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
      ai: {
        deck: [],
        hand: [],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
    },
    supply: {
      Copper: 40,
      Silver: 40,
      Gold: 30,
      Estate: 8,
      Duchy: 8,
      Province: 8,
      Village: 10,
      Smithy: 10,
      Market: 5,
      Festival: 3,
      Workshop: 10,
    },
    kingdomCards: [],
    playerOrder: ["human", "ai"],
    turn: 1,
    phase: "action",
    activePlayer: "human",
    actions: 1,
    buys: 1,
    coins: 0,
    gameOver: false,
    winner: null,
    pendingDecision: null,
    subPhase: null,
    trash: [],
    log: [],
    turnHistory: [],
  };
}

describe("peekDraw - Basic Drawing", () => {
  beforeEach(() => resetEventCounter());

  it("should peek cards from deck", () => {
    const playerState: PlayerState = {
      deck: ["Copper", "Silver", "Gold"],
      hand: [],
      discard: [],
      inPlay: [],
      inPlaySourceIndices: [],
    };

    const result = peekDraw(playerState, 2);

    expect(result.cards).toEqual(["Gold", "Silver"]); // Drawn from end
    expect(result.shuffled).toBe(false);
  });

  it("should peek all available cards when requesting more than deck size", () => {
    const playerState: PlayerState = {
      deck: ["Copper", "Silver"],
      hand: [],
      discard: [],
      inPlay: [],
      inPlaySourceIndices: [],
    };

    const result = peekDraw(playerState, 5);

    expect(result.cards.length).toBe(2);
    expect(result.shuffled).toBe(false);
  });

  it("should return empty array when deck and discard empty", () => {
    const playerState: PlayerState = {
      deck: [],
      hand: [],
      discard: [],
      inPlay: [],
      inPlaySourceIndices: [],
    };

    const result = peekDraw(playerState, 3);

    expect(result.cards).toEqual([]);
    expect(result.shuffled).toBe(false);
  });
});

describe("peekDraw - Shuffle Mechanics", () => {
  beforeEach(() => resetEventCounter());

  it("should shuffle discard when deck empty", () => {
    const playerState: PlayerState = {
      deck: [],
      hand: [],
      discard: ["Copper", "Silver", "Gold"],
      inPlay: [],
      inPlaySourceIndices: [],
    };

    const result = peekDraw(playerState, 2);

    expect(result.cards.length).toBe(2);
    expect(result.shuffled).toBe(true);
    expect(result.newDeckOrder).toBeDefined();
    expect(result.newDeckOrder!.length).toBe(3);
  });

  it("should shuffle mid-draw when deck runs out", () => {
    const playerState: PlayerState = {
      deck: ["Copper"],
      hand: [],
      discard: ["Silver", "Gold", "Estate"],
      inPlay: [],
      inPlaySourceIndices: [],
    };

    const result = peekDraw(playerState, 3);

    // Should draw 1 from deck, then shuffle discard and draw 2 more
    expect(result.cards.length).toBe(3);
    expect(result.cards[0]).toBe("Copper"); // First from original deck
    expect(result.shuffled).toBe(true);
    expect(result.newDeckOrder).toBeDefined();
  });

  it("should track cards before shuffle separately", () => {
    const playerState: PlayerState = {
      deck: ["Copper"],
      hand: [],
      discard: ["Silver", "Gold"],
      inPlay: [],
      inPlaySourceIndices: [],
    };

    const result = peekDraw(playerState, 2);

    expect(result.cardsBeforeShuffle).toBeDefined();
    expect(result.cardsBeforeShuffle).toEqual(["Copper"]);
  });

  it("should handle drawing more than deck+discard combined", () => {
    const playerState: PlayerState = {
      deck: ["Copper"],
      hand: [],
      discard: ["Silver"],
      inPlay: [],
      inPlaySourceIndices: [],
    };

    const result = peekDraw(playerState, 10);

    expect(result.cards.length).toBe(2); // Only 2 available
    expect(result.shuffled).toBe(true);
  });
});

describe("createDrawEvents - Event Generation", () => {
  beforeEach(() => resetEventCounter());

  it("should create CARD_DRAWN events without shuffle", () => {
    const playerState: PlayerState = {
      deck: ["Copper", "Silver", "Gold"],
      hand: [],
      discard: [],
      inPlay: [],
      inPlaySourceIndices: [],
    };

    const events = createDrawEvents("human", playerState, 2);

    const drawEvents = events.filter(e => e.type === "CARD_DRAWN");
    expect(drawEvents.length).toBe(2);
    expect(drawEvents[0].card).toBe("Gold");
    expect(drawEvents[1].card).toBe("Silver");
  });

  it("should create DECK_SHUFFLED event when shuffle occurs", () => {
    const playerState: PlayerState = {
      deck: [],
      hand: [],
      discard: ["Copper", "Silver", "Gold"],
      inPlay: [],
      inPlaySourceIndices: [],
    };

    const events = createDrawEvents("human", playerState, 2);

    const shuffleEvent = events.find(e => e.type === "DECK_SHUFFLED");
    expect(shuffleEvent).toBeDefined();
    expect(shuffleEvent!.newDeckOrder).toBeDefined();

    const drawEvents = events.filter(e => e.type === "CARD_DRAWN");
    expect(drawEvents.length).toBe(2);
  });

  it("should handle mid-draw shuffle with atomic events", () => {
    const playerState: PlayerState = {
      deck: ["Copper"],
      hand: [],
      discard: ["Silver", "Gold"],
      inPlay: [],
      inPlaySourceIndices: [],
    };

    const events = createDrawEvents("human", playerState, 3);

    // Should have: CARD_DRAWN (Copper), DECK_SHUFFLED, CARD_DRAWN (x2)
    const drawEvents = events.filter(e => e.type === "CARD_DRAWN");
    const shuffleEvent = events.find(e => e.type === "DECK_SHUFFLED");

    expect(drawEvents.length).toBe(3);
    expect(shuffleEvent).toBeDefined();
  });

  it("should return empty events when nothing to draw", () => {
    const playerState: PlayerState = {
      deck: [],
      hand: [],
      discard: [],
      inPlay: [],
      inPlaySourceIndices: [],
    };

    const events = createDrawEvents("human", playerState, 3);

    expect(events.length).toBe(0);
  });
});

describe("Card Type Checking Functions", () => {
  beforeEach(() => resetEventCounter());

  it("isActionCard should identify action cards", () => {
    expect(isActionCard("Village")).toBe(true);
    expect(isActionCard("Smithy")).toBe(true);
    expect(isActionCard("Militia")).toBe(true);
    expect(isActionCard("Throne Room")).toBe(true);
  });

  it("isActionCard should reject non-action cards", () => {
    expect(isActionCard("Copper")).toBe(false);
    expect(isActionCard("Silver")).toBe(false);
    expect(isActionCard("Estate")).toBe(false);
    expect(isActionCard("Duchy")).toBe(false);
  });

  it("isTreasureCard should identify treasures", () => {
    expect(isTreasureCard("Copper")).toBe(true);
    expect(isTreasureCard("Silver")).toBe(true);
    expect(isTreasureCard("Gold")).toBe(true);
  });

  it("isTreasureCard should reject non-treasures", () => {
    expect(isTreasureCard("Village")).toBe(false);
    expect(isTreasureCard("Estate")).toBe(false);
  });

  it("isVictoryCard should identify victory cards", () => {
    expect(isVictoryCard("Estate")).toBe(true);
    expect(isVictoryCard("Duchy")).toBe(true);
    expect(isVictoryCard("Province")).toBe(true);
    expect(isVictoryCard("Gardens")).toBe(true);
  });

  it("isVictoryCard should reject non-victory cards", () => {
    expect(isVictoryCard("Copper")).toBe(false);
    expect(isVictoryCard("Village")).toBe(false);
  });
});

describe("getGainableCards - Cost Filtering", () => {
  beforeEach(() => resetEventCounter());

  it("should return cards costing up to max", () => {
    const state = createBasicState();

    const cards = getGainableCards(state, 4);

    expect(cards).toContain("Copper"); // Cost 0
    expect(cards).toContain("Estate"); // Cost 2
    expect(cards).toContain("Silver"); // Cost 3
    expect(cards).toContain("Village"); // Cost 4
    expect(cards).not.toContain("Duchy"); // Cost 5
    expect(cards).not.toContain("Gold"); // Cost 6
  });

  it("should exclude cards with 0 supply", () => {
    const state = createBasicState();
    state.supply.Silver = 0;

    const cards = getGainableCards(state, 5);

    expect(cards).not.toContain("Silver");
    expect(cards).toContain("Copper");
    expect(cards).toContain("Estate");
  });

  it("should return empty array when all supply empty", () => {
    const state = createBasicState();
    state.supply = {};

    const cards = getGainableCards(state, 10);

    expect(cards).toEqual([]);
  });

  it("should handle maxCost 0 (only free cards)", () => {
    const state = createBasicState();

    const cards = getGainableCards(state, 0);

    expect(cards).toContain("Copper");
    expect(cards).not.toContain("Silver");
    expect(cards).not.toContain("Estate");
  });

  it("should handle maxCost 100 (all cards)", () => {
    const state = createBasicState();

    const cards = getGainableCards(state, 100);

    expect(cards.length).toBeGreaterThan(5);
    expect(cards).toContain("Province"); // Cost 8
  });
});

describe("getGainableTreasures - Treasure Filtering", () => {
  beforeEach(() => resetEventCounter());

  it("should return only treasures within cost limit", () => {
    const state = createBasicState();

    const treasures = getGainableTreasures(state, 3);

    expect(treasures).toContain("Copper"); // Cost 0
    expect(treasures).toContain("Silver"); // Cost 3
    expect(treasures).not.toContain("Gold"); // Cost 6
    expect(treasures).not.toContain("Village"); // Not a treasure
  });

  it("should exclude treasures with 0 supply", () => {
    const state = createBasicState();
    state.supply.Silver = 0;

    const treasures = getGainableTreasures(state, 5);

    expect(treasures).toContain("Copper");
    expect(treasures).not.toContain("Silver");
  });

  it("should return empty array when no treasures available", () => {
    const state = createBasicState();
    state.supply.Copper = 0;
    state.supply.Silver = 0;
    state.supply.Gold = 0;

    const treasures = getGainableTreasures(state, 10);

    expect(treasures).toEqual([]);
  });

  it("should handle Mine scenario: Copper + 3", () => {
    const state = createBasicState();

    const treasures = getGainableTreasures(state, 3); // Copper (0) + 3

    expect(treasures).toContain("Copper");
    expect(treasures).toContain("Silver"); // Cost 3
    expect(treasures).not.toContain("Gold"); // Cost 6
  });

  it("should handle Mine scenario: Silver + 3", () => {
    const state = createBasicState();

    const treasures = getGainableTreasures(state, 6); // Silver (3) + 3

    expect(treasures).toContain("Copper");
    expect(treasures).toContain("Silver");
    expect(treasures).toContain("Gold"); // Cost 6
  });
});

describe("getOpponents", () => {
  beforeEach(() => resetEventCounter());

  it("should return all other players", () => {
    const state = createBasicState();
    state.playerOrder = ["human", "ai"];

    const opponents = getOpponents(state, "human");

    expect(opponents).toEqual(["ai"]);
  });

  it("should return multiple opponents", () => {
    const state = createBasicState();
    state.players.ai2 = {
      deck: [],
      hand: [],
      discard: [],
      inPlay: [],
      inPlaySourceIndices: [],
    };
    state.playerOrder = ["human", "ai", "ai2"];

    const opponents = getOpponents(state, "human");

    expect(opponents.length).toBe(2);
    expect(opponents).toContain("ai");
    expect(opponents).toContain("ai2");
  });

  it("should exclude current player", () => {
    const state = createBasicState();
    state.playerOrder = ["human", "ai"];

    const opponents = getOpponents(state, "human");

    expect(opponents).not.toContain("human");
  });

  it("should handle single player (no opponents)", () => {
    const state = createBasicState();
    state.playerOrder = ["human"];

    const opponents = getOpponents(state, "human");

    expect(opponents).toEqual([]);
  });

  it("should filter out opponents not in state.players", () => {
    const state = createBasicState();
    state.playerOrder = ["human", "ai", "ai2"];
    // ai2 not in state.players

    const opponents = getOpponents(state, "human");

    expect(opponents).toContain("ai");
    expect(opponents).not.toContain("ai2");
  });
});

describe("createSimpleCardEffect - Factory Function", () => {
  beforeEach(() => resetEventCounter());

  it("should create effect that draws cards", () => {
    const state = createBasicState();
    state.players.human.deck = ["Copper", "Silver", "Gold"];

    const effect = createSimpleCardEffect({ cards: 3 });
    const result = effect({ state, player: "human", card: "Smithy" });

    const drawEvents = result.events.filter(e => e.type === "CARD_DRAWN");
    expect(drawEvents.length).toBe(3);
  });

  it("should create effect that gives actions", () => {
    const state = createBasicState();

    const effect = createSimpleCardEffect({ actions: 2 });
    const result = effect({ state, player: "human", card: "Village" });

    const actionsEvent = result.events.find(e => e.type === "ACTIONS_MODIFIED");
    expect(actionsEvent).toBeDefined();
    expect(actionsEvent!.delta).toBe(2);
  });

  it("should create effect that gives buys", () => {
    const state = createBasicState();

    const effect = createSimpleCardEffect({ buys: 1 });
    const result = effect({ state, player: "human", card: "Festival" });

    const buysEvent = result.events.find(e => e.type === "BUYS_MODIFIED");
    expect(buysEvent).toBeDefined();
    expect(buysEvent!.delta).toBe(1);
  });

  it("should create effect that gives coins", () => {
    const state = createBasicState();

    const effect = createSimpleCardEffect({ coins: 2 });
    const result = effect({ state, player: "human", card: "Festival" });

    const coinsEvent = result.events.find(e => e.type === "COINS_MODIFIED");
    expect(coinsEvent).toBeDefined();
    expect(coinsEvent!.delta).toBe(2);
  });

  it("should create effect with multiple benefits (Market)", () => {
    const state = createBasicState();
    state.players.human.deck = ["Copper"];

    const effect = createSimpleCardEffect({
      cards: 1,
      actions: 1,
      buys: 1,
      coins: 1,
    });
    const result = effect({ state, player: "human", card: "Market" });

    expect(result.events.find(e => e.type === "CARD_DRAWN")).toBeDefined();
    expect(result.events.find(e => e.type === "ACTIONS_MODIFIED")?.delta).toBe(
      1,
    );
    expect(result.events.find(e => e.type === "BUYS_MODIFIED")?.delta).toBe(1);
    expect(result.events.find(e => e.type === "COINS_MODIFIED")?.delta).toBe(1);
  });

  it("should create effect with no benefits (empty object)", () => {
    const state = createBasicState();

    const effect = createSimpleCardEffect({});
    const result = effect({ state, player: "human", card: "Test" as CardName });

    expect(result.events.length).toBe(0);
  });

  it("should exactly match Smithy behavior (+3 cards)", () => {
    const state = createBasicState();
    state.players.human.deck = ["Copper", "Silver", "Gold"];

    const smithyFactory = createSimpleCardEffect({ cards: 3 });
    const result = smithyFactory({ state, player: "human", card: "Smithy" });

    expect(result.events.filter(e => e.type === "CARD_DRAWN").length).toBe(3);
    expect(result.pendingDecision).toBeUndefined();
  });

  it("should exactly match Village behavior (+1 card, +2 actions)", () => {
    const state = createBasicState();
    state.players.human.deck = ["Copper"];

    const villageFactory = createSimpleCardEffect({ cards: 1, actions: 2 });
    const result = villageFactory({ state, player: "human", card: "Village" });

    expect(result.events.filter(e => e.type === "CARD_DRAWN").length).toBe(1);
    expect(result.events.find(e => e.type === "ACTIONS_MODIFIED")?.delta).toBe(
      2,
    );
  });

  it("should exactly match Festival behavior (+2 actions, +1 buy, +$2)", () => {
    const state = createBasicState();

    const festivalFactory = createSimpleCardEffect({
      actions: 2,
      buys: 1,
      coins: 2,
    });
    const result = festivalFactory({
      state,
      player: "human",
      card: "Festival",
    });

    expect(result.events.find(e => e.type === "ACTIONS_MODIFIED")?.delta).toBe(
      2,
    );
    expect(result.events.find(e => e.type === "BUYS_MODIFIED")?.delta).toBe(1);
    expect(result.events.find(e => e.type === "COINS_MODIFIED")?.delta).toBe(2);
  });
});

describe("Decision Helper Functions", () => {
  beforeEach(() => resetEventCounter());

  it("isInitialCall should detect initial calls", () => {
    expect(isInitialCall()).toBe(true);
    expect(isInitialCall(undefined, "trash")).toBe(true);
    expect(isInitialCall(undefined, "gain")).toBe(true);
  });

  it("isInitialCall should detect non-initial calls", () => {
    expect(isInitialCall({ selectedCards: [] }, "trash")).toBe(false);
  });

  it("createCardSelectionDecision should create valid decision", () => {
    const decision = createCardSelectionDecision({
      player: "human",
      from: "hand",
      prompt: "Choose cards",
      cardOptions: ["Copper", "Silver"],
      min: 1,
      max: 2,
      cardBeingPlayed: "Chapel",
      stage: "trash",
    });

    expect(decision.type).toBe("select_cards");
    expect(decision.player).toBe("human");
    expect(decision.from).toBe("hand");
    expect(decision.prompt).toBe("Choose cards");
    expect(decision.cardOptions).toEqual(["Copper", "Silver"]);
    expect(decision.min).toBe(1);
    expect(decision.max).toBe(2);
    expect(decision.cardBeingPlayed).toBe("Chapel");
    expect(decision.stage).toBe("trash");
  });

  it("createCardSelectionDecision should handle metadata", () => {
    const decision = createCardSelectionDecision({
      player: "human",
      from: "hand",
      prompt: "Test",
      cardOptions: [],
      min: 0,
      max: 1,
      cardBeingPlayed: "Library",
      stage: "skip_actions",
      metadata: { cardsNeeded: 5, peekedCards: ["Village"] },
    });

    expect(decision.metadata).toBeDefined();
    expect(decision.metadata).toEqual({
      cardsNeeded: 5,
      peekedCards: ["Village"],
    });
  });

  it("createCardSelectionDecision should work without metadata", () => {
    const decision = createCardSelectionDecision({
      player: "human",
      from: "hand",
      prompt: "Test",
      cardOptions: [],
      min: 0,
      max: 1,
      cardBeingPlayed: "Chapel",
      stage: "trash",
    });

    expect(decision.metadata).toBeUndefined();
  });
});

describe("Helper Function Integration", () => {
  beforeEach(() => resetEventCounter());

  it("createDrawEvents should use peekDraw correctly", () => {
    const playerState: PlayerState = {
      deck: ["Copper"],
      hand: [],
      discard: ["Silver", "Gold"],
      inPlay: [],
      inPlaySourceIndices: [],
    };

    // peekDraw should detect shuffle needed
    const peekResult = peekDraw(playerState, 3);
    expect(peekResult.shuffled).toBe(true);

    // createDrawEvents should generate shuffle event
    const events = createDrawEvents("human", playerState, 3);
    expect(events.find(e => e.type === "DECK_SHUFFLED")).toBeDefined();
  });

  it("getGainableTreasures should use card type checking", () => {
    const state = createBasicState();
    state.supply.Village = 10; // Cost 4, but not a treasure

    const treasures = getGainableTreasures(state, 5);

    // Should exclude Village even though it's within cost
    expect(treasures).not.toContain("Village");
    expect(treasures).toContain("Copper");
    expect(treasures).toContain("Silver");
  });

  it("createSimpleCardEffect should handle empty deck gracefully", () => {
    const state = createBasicState();
    state.players.human.deck = [];
    state.players.human.discard = [];

    const smithy = createSimpleCardEffect({ cards: 3 });
    const result = smithy({ state, player: "human", card: "Smithy" });

    // Should not crash, just return empty events
    const drawEvents = result.events.filter(e => e.type === "CARD_DRAWN");
    expect(drawEvents.length).toBe(0);
  });
});
