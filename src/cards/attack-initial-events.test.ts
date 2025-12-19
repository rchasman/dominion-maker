/**
 * TDD test to verify attack cards don't duplicate their initial benefits
 * Tests the fix for createOpponentIteratorEffect
 */

import { describe, it, expect, beforeEach } from "bun:test";
import type { GameState } from "../types/game-state";
import { handleCommand } from "../commands/handle";
import { resetEventCounter } from "../events/id-generator";
import { applyEvents } from "../events/apply";

function createBanditTestState(): GameState {
  return {
    players: {
      human: {
        deck: [],
        hand: ["Bandit"],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
      ai1: {
        deck: ["Copper", "Silver"], // Silver will be trashed
        hand: [],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
      ai2: {
        deck: ["Gold", "Duchy"], // Gold will be trashed
        hand: [],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
    },
    supply: {
      Copper: 40,
      Silver: 40,
      Gold: 29, // 1 less because Bandit will gain one
      Estate: 8,
      Duchy: 8,
      Province: 8,
      Bandit: 10,
    },
    activePlayerId: "human",
    phase: "action",
    actions: 1,
    buys: 1,
    coins: 0,
    playerOrder: ["human", "ai1", "ai2"],
    turnNumber: 1,
    trash: [],
    turnHistory: [],
    log: [],
  };
}

function createBureaucratTestState(): GameState {
  return {
    players: {
      human: {
        deck: [],
        hand: ["Bureaucrat"],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
      ai1: {
        deck: [],
        hand: ["Estate", "Copper"], // Has victory card
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
      ai2: {
        deck: [],
        hand: ["Duchy", "Estate", "Copper"], // Has 2 victory cards
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
    },
    supply: {
      Copper: 40,
      Silver: 39, // 1 less because Bureaucrat will gain one
      Gold: 30,
      Estate: 8,
      Duchy: 8,
      Province: 8,
      Bureaucrat: 10,
    },
    activePlayerId: "human",
    phase: "action",
    actions: 1,
    buys: 1,
    coins: 0,
    playerOrder: ["human", "ai1", "ai2"],
    turnNumber: 1,
    trash: [],
    turnHistory: [],
    log: [],
  };
}

describe("Attack Cards Initial Events Bug", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  describe("Bandit", () => {
    it("should only gain Gold once when playing Bandit", () => {
      const state = createBanditTestState();

      const playResult = handleCommand(
        state,
        { type: "PLAY_ACTION", card: "Bandit", playerId: "human" },
        "human",
      );

      expect(playResult.ok).toBe(true);
      if (!playResult.ok) throw new Error(`Play failed: ${playResult.error}`);

      // Should have exactly 1 CARD_GAINED event for Gold
      const goldGainEvents = playResult.events.filter(
        e => e.type === "CARD_GAINED" && e.card === "Gold",
      );
      expect(goldGainEvents.length).toBe(1);

      const newState = applyEvents(state, playResult.events);
      expect(newState.players.human?.discard).toContain("Gold");
      expect(newState.players.human?.discard.filter(c => c === "Gold").length).toBe(1);
    });

    it("should not duplicate Gold gain when processing opponent decisions", () => {
      const state = createBanditTestState();
      let currentState = state;

      // Track all Gold gains
      const allGoldGainEvents: unknown[] = [];

      // Play Bandit
      const playResult = handleCommand(
        currentState,
        { type: "PLAY_ACTION", card: "Bandit", playerId: "human" },
        "human",
      );

      expect(playResult.ok).toBe(true);
      if (!playResult.ok) throw new Error(`Play failed: ${playResult.error}`);

      allGoldGainEvents.push(
        ...playResult.events.filter(
          e => e.type === "CARD_GAINED" && e.card === "Gold",
        ),
      );

      currentState = applyEvents(currentState, playResult.events);

      // If there are any opponent decisions (2+ trashable treasures), process them
      while (currentState.pendingChoice?.choiceType === "decision") {
        const playerId = currentState.pendingChoice.playerId;
        const cardOptions = currentState.pendingChoice.cardOptions;

        const decisionResult = handleCommand(
          currentState,
          {
            type: "SUBMIT_DECISION",
            playerId,
            choice: {
              selectedCards: [cardOptions[0]!],
            },
          },
          playerId,
        );

        expect(decisionResult.ok).toBe(true);
        if (!decisionResult.ok)
          throw new Error(`Decision failed: ${decisionResult.error}`);

        // Should NOT have any Gold gains in opponent decisions
        const goldGainsInDecision = decisionResult.events.filter(
          e => e.type === "CARD_GAINED" && e.card === "Gold",
        );
        expect(goldGainsInDecision.length).toBe(0);

        allGoldGainEvents.push(...goldGainsInDecision);
        currentState = applyEvents(currentState, decisionResult.events);
      }

      // Total should be exactly 1 Gold gain
      expect(allGoldGainEvents.length).toBe(1);
      expect(currentState.players.human?.discard.filter(c => c === "Gold").length).toBe(1);
    });
  });

  describe("Bureaucrat", () => {
    it("should only gain Silver to deck once when playing Bureaucrat", () => {
      const state = createBureaucratTestState();

      const playResult = handleCommand(
        state,
        { type: "PLAY_ACTION", card: "Bureaucrat", playerId: "human" },
        "human",
      );

      expect(playResult.ok).toBe(true);
      if (!playResult.ok) throw new Error(`Play failed: ${playResult.error}`);

      // Should have exactly 1 CARD_GAINED event for Silver to deck
      const silverGainEvents = playResult.events.filter(
        e =>
          e.type === "CARD_GAINED" && e.card === "Silver" && e.to === "deck",
      );
      expect(silverGainEvents.length).toBe(1);

      const newState = applyEvents(state, playResult.events);
      expect(newState.players.human?.deck).toContain("Silver");
      expect(newState.players.human?.deck.filter(c => c === "Silver").length).toBe(1);
    });

    it("should not duplicate Silver gain when processing opponent decisions", () => {
      const state = createBureaucratTestState();
      let currentState = state;

      // Track all Silver gains
      const allSilverGainEvents: unknown[] = [];

      // Play Bureaucrat
      const playResult = handleCommand(
        currentState,
        { type: "PLAY_ACTION", card: "Bureaucrat", playerId: "human" },
        "human",
      );

      expect(playResult.ok).toBe(true);
      if (!playResult.ok) throw new Error(`Play failed: ${playResult.error}`);

      allSilverGainEvents.push(
        ...playResult.events.filter(
          e =>
            e.type === "CARD_GAINED" && e.card === "Silver" && e.to === "deck",
        ),
      );

      currentState = applyEvents(currentState, playResult.events);

      // Process opponent decisions
      while (currentState.pendingChoice?.choiceType === "decision") {
        const playerId = currentState.pendingChoice.playerId;
        const cardOptions = currentState.pendingChoice.cardOptions;

        const decisionResult = handleCommand(
          currentState,
          {
            type: "SUBMIT_DECISION",
            playerId,
            choice: {
              selectedCards: [cardOptions[0]!],
            },
          },
          playerId,
        );

        expect(decisionResult.ok).toBe(true);
        if (!decisionResult.ok)
          throw new Error(`Decision failed: ${decisionResult.error}`);

        // Should NOT have any Silver gains in opponent decisions
        const silverGainsInDecision = decisionResult.events.filter(
          e =>
            e.type === "CARD_GAINED" && e.card === "Silver" && e.to === "deck",
        );
        expect(silverGainsInDecision.length).toBe(0);

        allSilverGainEvents.push(...silverGainsInDecision);
        currentState = applyEvents(currentState, decisionResult.events);
      }

      // Total should be exactly 1 Silver gain
      expect(allSilverGainEvents.length).toBe(1);
      expect(currentState.players.human?.deck.filter(c => c === "Silver").length).toBe(1);
    });
  });
});
