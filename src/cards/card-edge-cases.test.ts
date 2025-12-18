import { describe, it, expect, beforeEach } from "bun:test";
import { getCardEffect } from "./base";
import { applyEvents } from "../events/apply";
import { resetEventCounter } from "../events/id-generator";
import { handleCommand } from "../commands/handle";
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
    playerOrder: ["human"],
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
    turn: 1,
    phase: "action",
    activePlayer: "human",
    actions: 1,
    buys: 1,
    coins: 0,
    gameOver: false,
    winner: null,
    pendingChoice: null,
    pendingChoiceEventId: null,
    trash: [],
    log: [],
    turnHistory: [],
  };
}

describe("Edge Cases - Empty Hand", () => {
  beforeEach(() => resetEventCounter());

  it("Cellar with empty hand gives +1 Action only", () => {
    const state = createTestState([]);
    const effect = getCardEffect("Cellar");
    expect(effect).toBeDefined();
    if (!effect) return;

    const result = effect({
      state,
      playerId: "human",
      card: "Cellar",
    });

    expect(result.events.find(e => e.type === "ACTIONS_MODIFIED")?.delta).toBe(
      1,
    );
    expect(result.pendingChoice).toBeUndefined();
  });

  it("Chapel with empty hand does nothing", () => {
    const state = createTestState([]);
    const effect = getCardEffect("Chapel");
    expect(effect).toBeDefined();
    if (!effect) return;

    const result = effect({
      state,
      playerId: "human",
      card: "Chapel",
    });

    expect(result.events.length).toBe(0);
    expect(result.pendingChoice).toBeUndefined();
  });

  it("Mine with no treasures does nothing", () => {
    const state = createTestState(["Estate", "Duchy"]);
    const effect = getCardEffect("Mine");
    expect(effect).toBeDefined();
    if (!effect) return;

    const result = effect({
      state,
      playerId: "human",
      card: "Mine",
    });

    expect(result.events.length).toBe(0);
  });

  it("Remodel with empty hand does nothing", () => {
    const state = createTestState([]);
    const effect = getCardEffect("Remodel");
    expect(effect).toBeDefined();
    if (!effect) return;

    const result = effect({
      state,
      playerId: "human",
      card: "Remodel",
    });

    expect(result.events.length).toBe(0);
  });

  it("Throne Room with no actions does nothing", () => {
    const state = createTestState(["Copper", "Estate"]);
    const effect = getCardEffect("Throne Room");
    expect(effect).toBeDefined();
    if (!effect) return;

    const result = effect({
      state,
      playerId: "human",
      card: "Throne Room",
    });

    expect(result.events.length).toBe(0);
  });
});

describe("Edge Cases - Empty Deck", () => {
  beforeEach(() => resetEventCounter());

  it("Smithy with empty deck and discard draws nothing", () => {
    const state = createTestState([], [], []);
    const effect = getCardEffect("Smithy");
    expect(effect).toBeDefined();
    if (!effect) return;

    const result = effect({
      state,
      playerId: "human",
      card: "Smithy",
    });

    expect(result.events.filter(e => e.type === "CARD_DRAWN").length).toBe(0);
  });

  it("Library with 7 cards already does nothing", () => {
    const state = createTestState(
      ["Copper", "Silver", "Gold", "Estate", "Duchy", "Province", "Village"],
      [],
    );
    const effect = getCardEffect("Library");
    expect(effect).toBeDefined();
    if (!effect) return;

    const result = effect({
      state,
      playerId: "human",
      card: "Library",
    });

    expect(result.events.length).toBe(0);
  });

  it("Vassal with empty deck gives +$2 only", () => {
    const state = createTestState([], []);
    const effect = getCardEffect("Vassal");
    expect(effect).toBeDefined();
    if (!effect) return;

    const result = effect({
      state,
      playerId: "human",
      card: "Vassal",
    });

    expect(result.events.find(e => e.type === "COINS_MODIFIED")?.delta).toBe(2);
    expect(result.pendingChoice).toBeUndefined();
  });

  it("Harbinger with empty discard skips topdeck decision", () => {
    const state = createTestState([], ["Copper"], []);
    const effect = getCardEffect("Harbinger");
    expect(effect).toBeDefined();
    if (!effect) return;

    const result = effect({
      state,
      playerId: "human",
      card: "Harbinger",
    });

    expect(result.events.filter(e => e.type === "CARD_DRAWN").length).toBe(1);
    expect(result.pendingChoice).toBeUndefined();
  });
});

describe("Edge Cases - Supply Constraints", () => {
  beforeEach(() => resetEventCounter());

  it("Workshop with empty supply does nothing", () => {
    const state = createTestState([]);
    state.supply = {};
    const effect = getCardEffect("Workshop");
    expect(effect).toBeDefined();
    if (!effect) return;

    const result = effect({
      state,
      playerId: "human",
      card: "Workshop",
    });

    expect(result.pendingChoice).toBeUndefined();
  });

  it("Workshop only offers cards costing ≤ 4", () => {
    const state = createTestState([]);
    const effect = getCardEffect("Workshop");
    expect(effect).toBeDefined();
    if (!effect) return;

    const result = effect({
      state,
      playerId: "human",
      card: "Workshop",
    });

    expect(result.pendingChoice).toBeDefined();
    if (!result.pendingChoice) return;
    expect(result.pendingChoice.cardOptions).not.toContain("Duchy");
    expect(result.pendingChoice.cardOptions).not.toContain("Gold");
  });

  it("Artisan only offers cards costing ≤ 5", () => {
    const state = createTestState(["Copper"]);
    const effect = getCardEffect("Artisan");
    expect(effect).toBeDefined();
    if (!effect) return;

    const result = effect({
      state,
      playerId: "human",
      card: "Artisan",
    });

    expect(result.pendingChoice).toBeDefined();
    if (!result.pendingChoice) return;
    expect(result.pendingChoice.cardOptions).toContain("Duchy");
    expect(result.pendingChoice.cardOptions).not.toContain("Gold");
  });
});

describe("Edge Cases - Opponent Interactions", () => {
  beforeEach(() => resetEventCounter());

  it("Militia vs opponent with ≤3 cards skips them", () => {
    const state = createTestState([]);
    state.players.human.hand = ["Militia"];
    state.players.ai = {
      deck: [],
      hand: ["Copper", "Estate", "Duchy"],
      discard: [],
      inPlay: [],
      inPlaySourceIndices: [],
    };
    state.playerOrder = ["human", "ai"];
    state.actions = 1;

    const result = handleCommand(
      state,
      { type: "PLAY_ACTION", card: "Militia", playerId: "human" },
      "human",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.events.find(e => e.type === "COINS_MODIFIED")?.delta).toBe(2);
    // Should not request decision since opponent has ≤3 cards
    expect(
      result.events.find(e => e.type === "DECISION_REQUIRED"),
    ).toBeUndefined();
  });

  it("Bureaucrat vs opponent with no victory cards skips them", () => {
    const state = createTestState([]);
    state.players.human.hand = ["Bureaucrat"];
    state.players.ai = {
      deck: [],
      hand: ["Copper", "Silver", "Gold"],
      discard: [],
      inPlay: [],
      inPlaySourceIndices: [],
    };
    state.playerOrder = ["human", "ai"];
    state.actions = 1;

    const result = handleCommand(
      state,
      { type: "PLAY_ACTION", card: "Bureaucrat", playerId: "human" },
      "human",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.events.find(e => e.type === "CARD_GAINED" && e.card === "Silver"),
    ).toBeDefined();
    // Should not request decision since opponent has no victory cards
    expect(
      result.events.find(e => e.type === "DECISION_REQUIRED"),
    ).toBeUndefined();
  });

  it("Witch with 2 opponents curses both", () => {
    const state = createTestState([], ["Copper", "Silver"]);
    state.players.human.hand = ["Witch"];
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
    state.actions = 1;

    const result = handleCommand(
      state,
      { type: "PLAY_ACTION", card: "Witch", playerId: "human" },
      "human",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const curseEvents = result.events.filter(
      e => e.type === "CARD_GAINED" && e.card === "Curse",
    );
    expect(curseEvents.length).toBe(2);
  });

  it("Council Room in single-player only draws for current player", () => {
    const state = createTestState([], ["Copper", "Silver", "Gold", "Estate"]);
    state.playerOrder = ["human"];

    const effect = getCardEffect("Council Room");
    expect(effect).toBeDefined();
    if (!effect) return;

    const result = effect({
      state,
      playerId: "human",
      card: "Council Room",
    });

    expect(result.events.filter(e => e.type === "CARD_DRAWN").length).toBe(4);
  });
});

describe("Edge Cases - Decision Cancellation", () => {
  beforeEach(() => resetEventCounter());

  it("Chapel skip handler trashes nothing", () => {
    const state = createTestState(["Copper", "Estate"]);

    const effect = getCardEffect("Chapel");
    expect(effect).toBeDefined();
    if (!effect) return;

    let result = effect({ state, playerId: "human", card: "Chapel" });

    // Get decision
    expect(result.pendingChoice).toBeDefined();
    if (result.pendingChoice) {
      state.pendingChoice = result.pendingChoice;
    }

    // Skip using on_skip stage
    result = effect({
      state,
      playerId: "human",
      card: "Chapel",
      decision: { selectedCards: [] },
      stage: "on_skip",
    });

    expect(result.events.length).toBe(0);
  });

  it("Cellar skip handler with 0 discarded draws nothing", () => {
    const state = createTestState(["Copper"], ["Silver"]);

    const effect = getCardEffect("Cellar");
    expect(effect).toBeDefined();
    if (!effect) return;

    let result = effect({
      state,
      playerId: "human",
      card: "Cellar",
      decision: undefined,
      stage: undefined,
    });

    if (result.pendingChoice) {
      state.pendingChoice = result.pendingChoice;
    }

    // Skip immediately using on_skip stage
    result = effect({
      state: applyEvents(state, result.events),
      playerId: "human",
      card: "Cellar",
      decision: { selectedCards: [] },
      stage: "on_skip",
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
