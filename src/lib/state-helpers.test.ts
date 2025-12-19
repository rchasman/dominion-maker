import { describe, it, expect } from "bun:test";
import { getSubPhase } from "./state-helpers";
import type { GameState, PlayerState } from "../types/game-state";

describe("state-helpers", () => {
  const createMockPlayer = (): PlayerState => ({
    deck: [],
    hand: [],
    discard: [],
    inPlay: [],
    actions: 1,
    buys: 1,
    coins: 0,
    deckTopRevealed: false,
  });

  describe("getSubPhase", () => {
    it("returns null when no pending choice", () => {
      const state: GameState = {
        players: { human: createMockPlayer() },
        activePlayerId: "human",
        phase: "action",
        turn: 1,
        supply: {},
        trash: [],
        pendingChoice: null,
      };
      expect(getSubPhase(state)).toBe(null);
    });

    it("returns opponent_decision when pending choice is for different player", () => {
      const state: GameState = {
        players: { human: createMockPlayer(), ai: createMockPlayer() },
        activePlayerId: "human",
        phase: "action",
        turn: 1,
        supply: {},
        trash: [],
        pendingChoice: {
          choiceType: "decision",
          playerId: "ai",
          prompt: "Choose",
          cards: [],
          min: 1,
          max: 1,
        },
      };
      expect(getSubPhase(state)).toBe("opponent_decision");
    });

    it("returns awaiting_reaction when pending choice is reaction", () => {
      const state: GameState = {
        players: { human: createMockPlayer() },
        activePlayerId: "human",
        phase: "action",
        turn: 1,
        supply: {},
        trash: [],
        pendingChoice: {
          choiceType: "reaction",
          playerId: "human",
          cards: ["Moat"],
        },
      };
      expect(getSubPhase(state)).toBe("awaiting_reaction");
    });

    it("returns null when pending choice is for active player (decision)", () => {
      const state: GameState = {
        players: { human: createMockPlayer() },
        activePlayerId: "human",
        phase: "action",
        turn: 1,
        supply: {},
        trash: [],
        pendingChoice: {
          choiceType: "decision",
          playerId: "human",
          prompt: "Choose",
          cards: [],
          min: 1,
          max: 1,
        },
      };
      expect(getSubPhase(state)).toBe(null);
    });

    it("prioritizes opponent_decision over reaction", () => {
      const state: GameState = {
        players: { human: createMockPlayer(), ai: createMockPlayer() },
        activePlayerId: "human",
        phase: "action",
        turn: 1,
        supply: {},
        trash: [],
        pendingChoice: {
          choiceType: "reaction",
          playerId: "ai",
          cards: ["Moat"],
        },
      };
      expect(getSubPhase(state)).toBe("opponent_decision");
    });

    it("returns awaiting_reaction for active player's reaction", () => {
      const state: GameState = {
        players: { human: createMockPlayer() },
        activePlayerId: "human",
        phase: "action",
        turn: 1,
        supply: {},
        trash: [],
        pendingChoice: {
          choiceType: "reaction",
          playerId: "human",
          cards: ["Moat"],
        },
      };
      expect(getSubPhase(state)).toBe("awaiting_reaction");
    });
  });
});
