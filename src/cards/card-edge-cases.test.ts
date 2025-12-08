import { describe, it, expect, beforeEach } from "bun:test";
import { getCardEffect } from "./base";
import { applyEvents } from "../events/apply";
import { resetEventCounter } from "../events/id-generator";
import type { GameState, CardName } from "../types/game-state";

/**
 * Edge case tests for all cards
 * Tests boundary conditions, empty states, and unusual scenarios
 */

function createTestState(
  hand: CardName[],
  deck: CardName[] = [],
  discard: CardName[] = [],
): GameState {
  return {
    players: {
      human: {
        deck,
        hand,
        discard,
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
      Curse: 10,
      Village: 10,
      Smithy: 10,
      Market: 10,
      Festival: 10,
      Laboratory: 10,
      Moat: 10,
      Cellar: 10,
      Chapel: 10,
      Harbinger: 10,
      Merchant: 10,
      Vassal: 10,
      Workshop: 10,
      Bureaucrat: 10,
      Gardens: 10,
      Militia: 10,
      Moneylender: 10,
      Poacher: 10,
      Remodel: 10,
      "Throne Room": 10,
      Bandit: 10,
      "Council Room": 10,
      Library: 10,
      Mine: 10,
      Sentry: 10,
      Witch: 10,
      Artisan: 10,
    },
    kingdomCards: [],
    playerOrder: ["human"],
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

describe("Edge Cases - Empty Hand", () => {
  beforeEach(() => resetEventCounter());

  it("Cellar with empty hand gives +1 Action only", () => {
    const state = createTestState([]);
    const result = getCardEffect("Cellar")!({
      state,
      player: "human",
      card: "Cellar",
    });

    expect(result.events.find(e => e.type === "ACTIONS_MODIFIED")?.delta).toBe(
      1,
    );
    expect(result.pendingDecision).toBeUndefined();
  });

  it("Chapel with empty hand does nothing", () => {
    const state = createTestState([]);
    const result = getCardEffect("Chapel")!({
      state,
      player: "human",
      card: "Chapel",
    });

    expect(result.events.length).toBe(0);
    expect(result.pendingDecision).toBeUndefined();
  });

  it("Mine with no treasures does nothing", () => {
    const state = createTestState(["Estate", "Duchy"]);
    const result = getCardEffect("Mine")!({
      state,
      player: "human",
      card: "Mine",
    });

    expect(result.events.length).toBe(0);
  });

  it("Remodel with empty hand does nothing", () => {
    const state = createTestState([]);
    const result = getCardEffect("Remodel")!({
      state,
      player: "human",
      card: "Remodel",
    });

    expect(result.events.length).toBe(0);
  });

  it("Throne Room with no actions does nothing", () => {
    const state = createTestState(["Copper", "Estate"]);
    const result = getCardEffect("Throne Room")!({
      state,
      player: "human",
      card: "Throne Room",
    });

    expect(result.events.length).toBe(0);
  });
});

describe("Edge Cases - Empty Deck", () => {
  beforeEach(() => resetEventCounter());

  it("Smithy with empty deck and discard draws nothing", () => {
    const state = createTestState([], [], []);
    const result = getCardEffect("Smithy")!({
      state,
      player: "human",
      card: "Smithy",
    });

    expect(result.events.filter(e => e.type === "CARD_DRAWN").length).toBe(0);
  });

  it("Library with 7 cards already does nothing", () => {
    const state = createTestState(
      ["Copper", "Silver", "Gold", "Estate", "Duchy", "Province", "Village"],
      [],
    );
    const result = getCardEffect("Library")!({
      state,
      player: "human",
      card: "Library",
    });

    expect(result.events.length).toBe(0);
  });

  it("Vassal with empty deck gives +$2 only", () => {
    const state = createTestState([], []);
    const result = getCardEffect("Vassal")!({
      state,
      player: "human",
      card: "Vassal",
    });

    expect(result.events.find(e => e.type === "COINS_MODIFIED")?.delta).toBe(2);
    expect(result.pendingDecision).toBeUndefined();
  });

  it("Harbinger with empty discard skips topdeck decision", () => {
    const state = createTestState([], ["Copper"], []);
    const result = getCardEffect("Harbinger")!({
      state,
      player: "human",
      card: "Harbinger",
    });

    expect(result.events.filter(e => e.type === "CARD_DRAWN").length).toBe(1);
    expect(result.pendingDecision).toBeUndefined();
  });
});

describe("Edge Cases - Supply Constraints", () => {
  beforeEach(() => resetEventCounter());

  it("Workshop with empty supply does nothing", () => {
    const state = createTestState([]);
    state.supply = {};
    const result = getCardEffect("Workshop")!({
      state,
      player: "human",
      card: "Workshop",
    });

    expect(result.pendingDecision).toBeUndefined();
  });

  it("Workshop only offers cards costing ≤ 4", () => {
    const state = createTestState([]);
    const result = getCardEffect("Workshop")!({
      state,
      player: "human",
      card: "Workshop",
    });

    expect(result.pendingDecision!.cardOptions).not.toContain("Duchy");
    expect(result.pendingDecision!.cardOptions).not.toContain("Gold");
  });

  it("Artisan only offers cards costing ≤ 5", () => {
    const state = createTestState(["Copper"]);
    const result = getCardEffect("Artisan")!({
      state,
      player: "human",
      card: "Artisan",
    });

    expect(result.pendingDecision!.cardOptions).toContain("Duchy");
    expect(result.pendingDecision!.cardOptions).not.toContain("Gold");
  });
});

describe("Edge Cases - Opponent Interactions", () => {
  beforeEach(() => resetEventCounter());

  it("Militia vs opponent with ≤3 cards skips them", () => {
    const state = createTestState([]);
    state.players.ai = {
      deck: [],
      hand: ["Copper", "Estate", "Duchy"],
      discard: [],
      inPlay: [],
      inPlaySourceIndices: [],
    };
    state.playerOrder = ["human", "ai"];

    const result = getCardEffect("Militia")!({
      state,
      player: "human",
      card: "Militia",
    });

    expect(result.events.find(e => e.type === "COINS_MODIFIED")?.delta).toBe(2);
    expect(result.pendingDecision).toBeUndefined();
  });

  it("Bureaucrat vs opponent with no victory cards skips them", () => {
    const state = createTestState([]);
    state.players.ai = {
      deck: [],
      hand: ["Copper", "Silver", "Gold"],
      discard: [],
      inPlay: [],
      inPlaySourceIndices: [],
    };
    state.playerOrder = ["human", "ai"];

    const result = getCardEffect("Bureaucrat")!({
      state,
      player: "human",
      card: "Bureaucrat",
    });

    expect(
      result.events.find(e => e.type === "CARD_GAINED" && e.card === "Silver"),
    ).toBeDefined();
    expect(result.pendingDecision).toBeUndefined();
  });

  it("Witch with 2 opponents curses both", () => {
    const state = createTestState([], ["Copper", "Silver"]);
    state.players.ai1 = {
      deck: [],
      hand: [],
      discard: [],
      inPlay: [],
      inPlaySourceIndices: [],
    };
    state.players.ai2 = {
      deck: [],
      hand: [],
      discard: [],
      inPlay: [],
      inPlaySourceIndices: [],
    };
    state.playerOrder = ["human", "ai1", "ai2"];

    const result = getCardEffect("Witch")!({
      state,
      player: "human",
      card: "Witch",
    });

    const curseEvents = result.events.filter(
      e => e.type === "CARD_GAINED" && e.card === "Curse",
    );
    expect(curseEvents.length).toBe(2);
  });

  it("Council Room in single-player only draws for current player", () => {
    const state = createTestState([], ["Copper", "Silver", "Gold", "Estate"]);
    state.playerOrder = ["human"];

    const result = getCardEffect("Council Room")!({
      state,
      player: "human",
      card: "Council Room",
    });

    expect(result.events.filter(e => e.type === "CARD_DRAWN").length).toBe(4);
  });
});

describe("Edge Cases - Decision Cancellation", () => {
  beforeEach(() => resetEventCounter());

  it("Chapel selecting 0 cards trashes nothing", () => {
    const state = createTestState(["Copper", "Estate"]);

    const effect = getCardEffect("Chapel")!;
    let result = effect({ state, player: "human", card: "Chapel" });

    // Get decision
    expect(result.pendingDecision).toBeDefined();

    // Submit empty selection
    result = effect({
      state,
      player: "human",
      card: "Chapel",
      decision: { selectedCards: [] },
      stage: "trash",
    });

    expect(result.events.length).toBe(0);
  });

  it("Cellar selecting 0 cards draws nothing", () => {
    const state = createTestState(["Copper"], ["Silver"]);

    const effect = getCardEffect("Cellar")!;
    let result = effect({
      state,
      player: "human",
      card: "Cellar",
      decision: undefined,
      stage: undefined,
    });

    result = effect({
      state: applyEvents(state, result.events),
      player: "human",
      card: "Cellar",
      decision: { selectedCards: [] },
      stage: "discard",
    });

    const drawEvents = result.events.filter(e => e.type === "CARD_DRAWN");
    expect(drawEvents.length).toBe(0);
  });
});

describe("All Cards Have Effects", () => {
  beforeEach(() => resetEventCounter());

  it("validates all 25 action cards have effects", () => {
    const cards: CardName[] = [
      "Cellar",
      "Chapel",
      "Moat",
      "Harbinger",
      "Merchant",
      "Vassal",
      "Village",
      "Workshop",
      "Bureaucrat",
      "Militia",
      "Moneylender",
      "Poacher",
      "Remodel",
      "Smithy",
      "Throne Room",
      "Bandit",
      "Council Room",
      "Festival",
      "Laboratory",
      "Library",
      "Market",
      "Mine",
      "Sentry",
      "Witch",
      "Artisan",
    ];

    for (const card of cards) {
      expect(getCardEffect(card)).toBeDefined();
    }
  });

  it("validates treasures have no effects", () => {
    expect(getCardEffect("Copper")).toBeUndefined();
    expect(getCardEffect("Silver")).toBeUndefined();
    expect(getCardEffect("Gold")).toBeUndefined();
  });

  it("validates basic victories have no effects", () => {
    expect(getCardEffect("Estate")).toBeUndefined();
    expect(getCardEffect("Duchy")).toBeUndefined();
    expect(getCardEffect("Province")).toBeUndefined();
  });
});
