import { describe, it, expect, beforeEach } from "bun:test";
import { getCardEffect } from "../cards/base";
import { applyEvents } from "./apply";
import { resetEventCounter } from "./id-generator";
import type { GameState } from "../types/game-state";

/**
 * Tests for centralized supply depletion enforcement
 * Verifies that cards no longer need to check supply themselves
 */

function createTestState(): GameState {
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
      Silver: 0, // Empty Silver supply
      Gold: 0, // Empty Gold supply
      Curse: 0, // Empty Curse supply
      Estate: 8,
      Duchy: 8,
      Province: 8,
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
    pendingDecisionEventId: null,
    subPhase: null,
    trash: [],
    log: [],
    turnHistory: [],
    activeEffects: [],
  };
}

describe("Supply Depletion - Centralized Enforcement", () => {
  beforeEach(() => resetEventCounter());

  it("Witch with empty Curse supply does not gain Curses", () => {
    const state = createTestState();
    state.players.human.deck = ["Copper", "Silver"];

    const effect = getCardEffect("Witch");
    expect(effect).toBeDefined();
    if (!effect) return;

    const result = effect({
      state,
      player: "human",
      card: "Witch",
      attackTargets: ["ai"], // Simulate resolved attack
    });

    // Apply events
    const newState = applyEvents(state, result.events);

    // Verify draws happened
    expect(newState.players.human.hand.length).toBe(2);

    // Verify Curse was not gained (supply was empty)
    expect(newState.players.ai.discard.length).toBe(0);
    expect(newState.supply.Curse).toBe(0);
  });

  it("Bureaucrat with empty Silver supply does not gain Silver", () => {
    const state = createTestState();

    const effect = getCardEffect("Bureaucrat");
    expect(effect).toBeDefined();
    if (!effect) return;

    const result = effect({
      state,
      player: "human",
      card: "Bureaucrat",
      attackTargets: [], // No opponents with victory cards
    });

    // Apply events
    const newState = applyEvents(state, result.events);

    // Verify Silver was not gained (supply was empty)
    expect(newState.players.human.deck.length).toBe(0);
    expect(newState.supply.Silver).toBe(0);
  });

  it("Bandit with empty Gold supply does not gain Gold", () => {
    const state = createTestState();

    const effect = getCardEffect("Bandit");
    expect(effect).toBeDefined();
    if (!effect) return;

    const result = effect({
      state,
      player: "human",
      card: "Bandit",
      attackTargets: [], // No opponents
    });

    // Apply events
    const newState = applyEvents(state, result.events);

    // Verify Gold was not gained (supply was empty)
    expect(newState.players.human.discard.length).toBe(0);
    expect(newState.supply.Gold).toBe(0);
  });

  it("Multiple Witch plays with limited Curse supply", () => {
    const state = createTestState();
    state.supply.Curse = 1; // Only 1 Curse available
    state.players.human.deck = ["Copper", "Silver", "Gold", "Estate"];
    state.playerOrder = ["human", "ai1", "ai2"];
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

    const effect = getCardEffect("Witch");
    expect(effect).toBeDefined();
    if (!effect) return;

    const result = effect({
      state,
      player: "human",
      card: "Witch",
      attackTargets: ["ai1", "ai2"], // 2 targets, but only 1 Curse
    });

    // Apply events
    const newState = applyEvents(state, result.events);

    // Verify draws happened
    expect(newState.players.human.hand.length).toBe(2);

    // Verify only 1 Curse was gained (first target gets it, second doesn't)
    const totalCursesGained =
      newState.players.ai1.discard.filter(c => c === "Curse").length +
      newState.players.ai2.discard.filter(c => c === "Curse").length;
    expect(totalCursesGained).toBe(1);
    expect(newState.supply.Curse).toBe(0);
  });
});
