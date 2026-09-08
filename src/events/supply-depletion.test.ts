import { describe, it, expect, beforeEach } from "bun:test";
import { handleCommand } from "../commands/handle";
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
    } as GameState["supply"],
    kingdomCards: [],
    playerOrder: ["human", "ai"],
    turn: 1,
    phase: "action",
    activePlayerId: "human",
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

describe("Supply Depletion - Centralized Enforcement", () => {
  beforeEach(() => resetEventCounter());

  it("Witch with empty Curse supply does not gain Curses", () => {
    const state = createTestState();
    state.players.human!.deck = ["Copper", "Silver"];

    state.players.human!.hand = ["Witch"];
    const result = handleCommand(
      state,
      { type: "PLAY_ACTION", playerId: "human", card: "Witch" },
      "human",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);

    // Apply events
    const newState = applyEvents(state, result.events);

    // Verify draws happened
    expect(newState.players.human!.hand.length).toBe(2);

    // Verify Curse was not gained (supply was empty)
    expect(newState.players.ai!.discard.length).toBe(0);
    expect(newState.supply.Curse).toBe(0);
  });

  it("Bureaucrat with empty Silver supply does not gain Silver", () => {
    const state = createTestState();

    state.players.human!.hand = ["Bureaucrat"];
    const result = handleCommand(
      state,
      { type: "PLAY_ACTION", playerId: "human", card: "Bureaucrat" },
      "human",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);

    // Apply events
    const newState = applyEvents(state, result.events);

    // Verify Silver was not gained (supply was empty)
    expect(newState.players.human!.deck.length).toBe(0);
    expect(newState.supply.Silver).toBe(0);
  });

  it("Bandit with empty Gold supply does not gain Gold", () => {
    const state = createTestState();

    state.players.human!.hand = ["Bandit"];
    const result = handleCommand(
      state,
      { type: "PLAY_ACTION", playerId: "human", card: "Bandit" },
      "human",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);

    // Apply events
    const newState = applyEvents(state, result.events);

    // Verify Gold was not gained (supply was empty)
    expect(newState.players.human!.discard.length).toBe(0);
    expect(newState.supply.Gold).toBe(0);
  });

  it("Multiple Witch plays with limited Curse supply", () => {
    const state = createTestState();
    state.supply.Curse = 1; // Only 1 Curse available
    state.players.human!.deck = ["Copper", "Silver", "Gold", "Estate"];
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

    state.players.human!.hand = ["Witch"];
    const result = handleCommand(
      state,
      { type: "PLAY_ACTION", playerId: "human", card: "Witch" },
      "human",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);

    // Apply events
    const newState = applyEvents(state, result.events);

    // Verify draws happened
    expect(newState.players.human!.hand.length).toBe(2);

    // Verify only 1 Curse was gained (first target gets it, second doesn't)
    const totalCursesGained =
      newState.players.ai1!.discard.filter(c => c === "Curse").length +
      newState.players.ai2!.discard.filter(c => c === "Curse").length;
    expect(totalCursesGained).toBe(1);
    expect(newState.supply.Curse).toBe(0);
  });
});
