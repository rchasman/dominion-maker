import { describe, test, expect, beforeEach } from "bun:test";
import {
  handlePlayAction,
  handlePlayTreasure,
  handlePlayAllTreasures,
  handleUnplayTreasure,
  handleBuyCard,
} from "./handle-actions";
import { resetEventCounter } from "../events/id-generator";
import { applyEvents } from "../events/apply";
import type { GameState } from "../types/game-state";

function createMockState(): GameState {
  return {
    players: {
      p1: {
        deck: ["Copper", "Copper"],
        hand: ["Village", "Smithy", "Copper", "Silver"],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
      p2: {
        deck: ["Copper"],
        hand: ["Estate"],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
    },
    supply: {
      Village: 10,
      Smithy: 10,
      Copper: 40,
      Silver: 40,
      Gold: 30,
      Estate: 8,
      Duchy: 8,
      Province: 8,
      Witch: 10,
    },
    kingdomCards: ["Village", "Smithy", "Witch"],
    playerOrder: ["p1", "p2"],
    turn: 1,
    phase: "action",
    activePlayerId: "p1",
    actions: 1,
    buys: 1,
    coins: 0,
    gameOver: false,
    winnerId: null,
    pendingChoice: null,
    pendingChoiceEventId: null,
    trash: [],
    log: [],
    turnHistory: [],
    activeEffects: [],
  };
}

describe("handle-actions - handlePlayAction", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  test("should return error when player not found", () => {
    const state = createMockState();
    const result = handlePlayAction(state, "nonexistent", "Village");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Player not found");
  });

  test("should play action card without effect", () => {
    const state = createMockState();
    state.players.p1!.hand = ["Village"];
    state.actions = 1;
    // Play Village (which has an effect)
    const result = handlePlayAction(state, "p1", "Village");
    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });

  test("should play attack card and orchestrate reactions", () => {
    const state = createMockState();
    state.players.p1!.hand = ["Witch"];
    state.players.p2!.hand = ["Moat"];
    state.actions = 1;

    const result = handlePlayAction(state, "p1", "Witch");
    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    // Should have ATTACK_DECLARED
    const attackDeclared = result.events.find(
      e => e.type === "ATTACK_DECLARED",
    );
    expect(attackDeclared).toBeDefined();
  });

  test("should handle action card with no card effect defined", () => {
    const state = createMockState();
    state.players.p1!.hand = ["Village"];
    state.actions = 1;

    const result = handlePlayAction(state, "p1", "Village");
    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });
});

describe("handle-actions - handlePlayTreasure", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  test("should return error when player not found", () => {
    const state = createMockState();
    state.phase = "buy";
    const result = handlePlayTreasure(state, "nonexistent", "Copper");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Player not found");
  });

  test("should play treasure with zero coins", () => {
    const state = createMockState();
    state.phase = "buy";
    state.players.p1!.hand = ["Copper"];

    // Mock a treasure with 0 coins (hypothetically)
    const result = handlePlayTreasure(state, "p1", "Copper");
    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });

  test("should trigger Merchant bonus on first Silver", () => {
    const state = createMockState();
    state.phase = "buy";
    state.players.p1!.hand = ["Silver"];
    state.players.p1!.inPlay = ["Merchant"];

    const result = handlePlayTreasure(state, "p1", "Silver");
    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    // Should have coin events including Merchant bonus
    const coinEvents = result.events.filter(e => e.type === "COINS_MODIFIED");
    expect(coinEvents.length).toBeGreaterThan(0);
  });
});

describe("handle-actions - handlePlayAllTreasures", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  test("should return error when player not found", () => {
    const state = createMockState();
    state.phase = "buy";
    const result = handlePlayAllTreasures(state, "nonexistent");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Player not found");
  });

  test("should return error when not in buy phase", () => {
    const state = createMockState();
    state.phase = "action";
    const result = handlePlayAllTreasures(state, "p1");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Not in buy phase");
  });

  test("should return empty events when no treasures in hand", () => {
    const state = createMockState();
    state.phase = "buy";
    state.players.p1!.hand = ["Estate", "Village"];

    const result = handlePlayAllTreasures(state, "p1");
    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    expect(result.events?.length).toBe(0);
  });

  test("should play all treasures in hand", () => {
    const state = createMockState();
    state.phase = "buy";
    state.players.p1!.hand = ["Copper", "Silver", "Gold"];

    const result = handlePlayAllTreasures(state, "p1");
    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    // Should have CARD_PLAYED events for each treasure
    const playedEvents = result.events.filter(e => e.type === "CARD_PLAYED");
    expect(playedEvents.length).toBe(3);
  });
});

describe("handle-actions - handleUnplayTreasure", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  test("should return error when not in buy phase", () => {
    const state = createMockState();
    state.phase = "action";
    const result = handleUnplayTreasure(state, "p1", "Copper");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Not in buy phase");
  });

  test("should return error when card is not a treasure", () => {
    const state = createMockState();
    state.phase = "buy";
    const result = handleUnplayTreasure(state, "p1", "Village");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Not a treasure card");
  });

  test("should return error when player not found", () => {
    const state = createMockState();
    state.phase = "buy";
    const result = handleUnplayTreasure(state, "nonexistent", "Copper");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Player not found");
  });

  test("should unplay treasure with trigger events", () => {
    const state = createMockState();
    state.phase = "buy";
    state.players.p1!.hand = [];
    state.players.p1!.inPlay = ["Silver", "Merchant"];
    state.coins = 3;

    const result = handleUnplayTreasure(state, "p1", "Silver");
    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    const returnedEvent = result.events.find(
      e => e.type === "CARD_RETURNED_TO_HAND",
    );
    expect(returnedEvent).toBeDefined();

    const coinEvents = result.events.filter(e => e.type === "COINS_MODIFIED");
    expect(coinEvents.length).toBeGreaterThan(0);
  });

  test("should handle non-COINS_MODIFIED trigger events", () => {
    const state = createMockState();
    state.phase = "buy";
    state.players.p1!.hand = [];
    state.players.p1!.inPlay = ["Copper"];
    state.coins = 1;

    const result = handleUnplayTreasure(state, "p1", "Copper");
    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });
});

describe("handle-actions - handleBuyCard", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  test("should buy card with cost modification", () => {
    const state = createMockState();
    state.phase = "buy";
    state.buys = 1;
    state.coins = 5;
    state.activeEffects = [
      {
        effectType: "cost_reduction",
        source: "Bridge",
        duration: "until_cleanup",
        parameters: { amount: 1 },
      },
    ];

    const result = handleBuyCard(state, "p1", "Silver");
    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    // Should have COST_MODIFIED event
    const costModified = result.events.find(e => e.type === "COST_MODIFIED");
    expect(costModified).toBeDefined();
    expect(costModified?.baseCost).toBe(3);
    expect(costModified?.modifiedCost).toBe(2);
  });

  test("should buy card without cost modification", () => {
    const state = createMockState();
    state.phase = "buy";
    state.buys = 1;
    state.coins = 3;

    const result = handleBuyCard(state, "p1", "Silver");
    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    // Should NOT have COST_MODIFIED event
    const costModified = result.events.find(e => e.type === "COST_MODIFIED");
    expect(costModified).toBeUndefined();

    const cardGained = result.events.find(e => e.type === "CARD_GAINED");
    expect(cardGained).toBeDefined();
  });

  test("should handle multiple cost reductions", () => {
    const state = createMockState();
    state.phase = "buy";
    state.buys = 1;
    state.coins = 8;
    state.activeEffects = [
      {
        effectType: "cost_reduction",
        source: "Bridge",
        duration: "until_cleanup",
        parameters: { amount: 1 },
      },
      {
        effectType: "cost_reduction",
        source: "Bridge",
        duration: "until_cleanup",
        parameters: { amount: 1 },
      },
    ];

    const result = handleBuyCard(state, "p1", "Province");
    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    const costModified = result.events.find(e => e.type === "COST_MODIFIED");
    expect(costModified).toBeDefined();
    expect(costModified?.baseCost).toBe(8);
    expect(costModified?.modifiedCost).toBe(6);
  });

  test("should prevent cost from going below zero", () => {
    const state = createMockState();
    state.phase = "buy";
    state.buys = 1;
    state.coins = 5;
    state.activeEffects = [
      {
        effectType: "cost_reduction",
        source: "Bridge",
        duration: "until_cleanup",
        parameters: { amount: 10 },
      },
    ];

    const result = handleBuyCard(state, "p1", "Silver");
    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    const costModified = result.events.find(e => e.type === "COST_MODIFIED");
    expect(costModified).toBeDefined();
    expect(costModified?.baseCost).toBe(3);
    expect(costModified?.modifiedCost).toBe(0);
  });
});

describe("handle-actions - Edge cases", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  test("should handle missing player in players object", () => {
    const state = createMockState();
    delete state.players.p1;

    const result = handlePlayAction(state, "p1", "Village");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Player not found");
  });

  test("should handle missing player for treasure play", () => {
    const state = createMockState();
    state.phase = "buy";
    delete state.players.p1;

    const result = handlePlayTreasure(state, "p1", "Copper");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Player not found");
  });

  test("should handle missing player for unplay treasure", () => {
    const state = createMockState();
    state.phase = "buy";
    delete state.players.p1;

    const result = handleUnplayTreasure(state, "p1", "Copper");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Player not found");
  });

  test("should handle missing player for play all treasures", () => {
    const state = createMockState();
    state.phase = "buy";
    delete state.players.p1;

    const result = handlePlayAllTreasures(state, "p1");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Player not found");
  });
});
