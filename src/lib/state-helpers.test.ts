import { describe, it, expect } from "bun:test";
import { getSubPhase } from "./state-helpers";
import type { GameState, PlayerState } from "../types/game-state";

describe("state-helpers", () => {
  const createMockPlayer = (): PlayerState => ({
    deck: [],
    hand: [],
    discard: [],
    inPlay: [],
    inPlaySourceIndices: [],
    deckTopRevealed: false,
  });

  const emptySupply: Record<string, number> = {};

  const createMockState = (overrides: Partial<GameState> = {}): GameState => ({
    players: { human: createMockPlayer() },
    activePlayerId: "human",
    phase: "action",
    turn: 1,
    actions: 1,
    buys: 1,
    coins: 0,
    supply: emptySupply,
    trash: [],
    kingdomCards: [],
    pendingChoice: null,
    pendingChoiceEventId: null,
    gameOver: false,
    winnerId: null,
    log: [],
    turnHistory: [],
    playerOrder: ["human", "ai"],
    activeEffects: [],
    ...overrides,
  });

  const reactionMetadata = {
    allTargets: ["human"],
    currentTargetIndex: 0,
    blockedTargets: [],
    originalCause: "event-1",
  };

  describe("getSubPhase", () => {
    it("returns null when no pending choice", () => {
      const state: GameState = createMockState({
        pendingChoice: null,
      });
      expect(getSubPhase(state)).toBe(null);
    });

    it("returns opponent_decision when pending choice is for different player", () => {
      const state: GameState = createMockState({
        players: { human: createMockPlayer(), ai: createMockPlayer() },
        pendingChoice: {
          choiceType: "decision",
          playerId: "ai",
          prompt: "Choose",
          cardBeingPlayed: "Militia",
          cardOptions: [],
          min: 1,
          max: 1,
        },
      });
      expect(getSubPhase(state)).toBe("opponent_decision");
    });

    it("returns awaiting_reaction when pending choice is reaction", () => {
      const state: GameState = createMockState({
        pendingChoice: {
          choiceType: "reaction",
          playerId: "human",
          triggeringPlayerId: "ai",
          triggeringCard: "Militia",
          triggerType: "on_attack",
          availableReactions: ["Moat"],
          metadata: reactionMetadata,
        },
      });
      expect(getSubPhase(state)).toBe("awaiting_reaction");
    });

    it("returns null when pending choice is for active player (decision)", () => {
      const state: GameState = createMockState({
        pendingChoice: {
          choiceType: "decision",
          playerId: "human",
          prompt: "Choose",
          cardBeingPlayed: "Cellar",
          cardOptions: [],
          min: 1,
          max: 1,
        },
      });
      expect(getSubPhase(state)).toBe(null);
    });

    it("prioritizes opponent_decision over reaction", () => {
      const state: GameState = createMockState({
        players: { human: createMockPlayer(), ai: createMockPlayer() },
        pendingChoice: {
          choiceType: "reaction",
          playerId: "ai",
          triggeringPlayerId: "human",
          triggeringCard: "Militia",
          triggerType: "on_attack",
          availableReactions: ["Moat"],
          metadata: {
            allTargets: ["ai"],
            currentTargetIndex: 0,
            blockedTargets: [],
            originalCause: "event-1",
          },
        },
      });
      expect(getSubPhase(state)).toBe("opponent_decision");
    });

    it("returns awaiting_reaction for active player's reaction", () => {
      const state: GameState = createMockState({
        pendingChoice: {
          choiceType: "reaction",
          playerId: "human",
          triggeringPlayerId: "ai",
          triggeringCard: "Militia",
          triggerType: "on_attack",
          availableReactions: ["Moat"],
          metadata: reactionMetadata,
        },
      });
      expect(getSubPhase(state)).toBe("awaiting_reaction");
    });
  });
});
