import { describe, it, expect } from "bun:test";
import { hasPlayableActions, hasTreasuresInHand } from "./derived-state";
import type { CardName, GameState, PlayerState } from "../types/game-state";

describe("derived-state utilities", () => {
  const mockPlayer = (hand: CardName[] = []): PlayerState => ({
    deck: [],
    hand,
    discard: [],
    inPlay: [],
    inPlaySourceIndices: [],
  });

  const emptySupply: Record<string, number> = {};

  const createMockGameState = (
    overrides: Partial<GameState> = {},
  ): GameState => ({
    gameOver: false,
    turn: 1,
    phase: "action",
    actions: 1,
    buys: 1,
    coins: 0,
    activePlayerId: "human",
    players: {
      human: mockPlayer(),
      ai: mockPlayer(),
    },
    supply: emptySupply,
    trash: [],
    kingdomCards: [],
    pendingChoice: null,
    pendingChoiceEventId: null,
    winnerId: null,
    log: [],
    turnHistory: [],
    playerOrder: ["human", "ai"],
    activeEffects: [],
    ...overrides,
  });

  describe("hasPlayableActions", () => {
    it("should return false when gameState is null", () => {
      expect(hasPlayableActions(null)).toBe(false);
    });

    it("should return false when gameState is undefined", () => {
      // Deliberately out-of-contract: verify the runtime guard handles undefined
      const state = undefined as unknown as GameState | null;
      expect(hasPlayableActions(state)).toBe(false);
    });

    it("should return false when player does not exist", () => {
      const state = createMockGameState();
      expect(hasPlayableActions(state, "nonexistent")).toBe(false);
    });

    it("should return false when hand is empty", () => {
      const state = createMockGameState({
        actions: 1,
        players: {
          human: mockPlayer(),
          ai: mockPlayer(),
        },
      });
      expect(hasPlayableActions(state, "human")).toBe(false);
    });

    it("should return false when no action cards in hand", () => {
      const state = createMockGameState({
        actions: 1,
        players: {
          human: mockPlayer(["Copper", "Silver", "Gold"]),
          ai: mockPlayer(),
        },
      });
      expect(hasPlayableActions(state, "human")).toBe(false);
    });

    it("should return false when actions count is zero", () => {
      const state = createMockGameState({
        actions: 0,
        players: {
          human: mockPlayer(["Village"]),
          ai: mockPlayer(),
        },
      });
      expect(hasPlayableActions(state, "human")).toBe(false);
    });

    it("should return true when hand has action card and actions > 0", () => {
      const state = createMockGameState({
        actions: 1,
        players: {
          human: mockPlayer(["Village"]),
          ai: mockPlayer(),
        },
      });
      expect(hasPlayableActions(state, "human")).toBe(true);
    });

    it("should default to human player when playerId is not provided", () => {
      const state = createMockGameState({
        actions: 1,
        players: {
          human: mockPlayer(["Village"]),
          ai: mockPlayer(),
        },
      });
      expect(hasPlayableActions(state)).toBe(true);
    });

    it("should handle multiple action cards in hand", () => {
      const state = createMockGameState({
        actions: 2,
        players: {
          human: mockPlayer(["Village", "Smithy", "Market"]),
          ai: mockPlayer(),
        },
      });
      expect(hasPlayableActions(state, "human")).toBe(true);
    });

    it("should work for non-human players", () => {
      const state = createMockGameState({
        actions: 1,
        players: {
          human: mockPlayer(),
          ai: mockPlayer(["Cellar"]),
        },
      });
      expect(hasPlayableActions(state, "ai")).toBe(true);
    });
  });

  describe("hasTreasuresInHand", () => {
    it("should return false when gameState is null", () => {
      expect(hasTreasuresInHand(null)).toBe(false);
    });

    it("should return false when gameState is undefined", () => {
      // Deliberately out-of-contract: verify the runtime guard handles undefined
      const state = undefined as unknown as GameState | null;
      expect(hasTreasuresInHand(state)).toBe(false);
    });

    it("should return false when player does not exist", () => {
      const state = createMockGameState();
      expect(hasTreasuresInHand(state, "nonexistent")).toBe(false);
    });

    it("should return false when hand is empty", () => {
      const state = createMockGameState({
        players: {
          human: mockPlayer(),
          ai: mockPlayer(),
        },
      });
      expect(hasTreasuresInHand(state, "human")).toBe(false);
    });

    it("should return false when no treasure cards in hand", () => {
      const state = createMockGameState({
        players: {
          human: mockPlayer(["Village", "Smithy", "Militia"]),
          ai: mockPlayer(),
        },
      });
      expect(hasTreasuresInHand(state, "human")).toBe(false);
    });

    it("should return true when Copper in hand", () => {
      const state = createMockGameState({
        players: {
          human: mockPlayer(["Copper"]),
          ai: mockPlayer(),
        },
      });
      expect(hasTreasuresInHand(state, "human")).toBe(true);
    });

    it("should return true when Silver in hand", () => {
      const state = createMockGameState({
        players: {
          human: mockPlayer(["Silver"]),
          ai: mockPlayer(),
        },
      });
      expect(hasTreasuresInHand(state, "human")).toBe(true);
    });

    it("should return true when Gold in hand", () => {
      const state = createMockGameState({
        players: {
          human: mockPlayer(["Gold"]),
          ai: mockPlayer(),
        },
      });
      expect(hasTreasuresInHand(state, "human")).toBe(true);
    });

    it("should return true when multiple treasures in hand", () => {
      const state = createMockGameState({
        players: {
          human: mockPlayer(["Copper", "Silver", "Gold"]),
          ai: mockPlayer(),
        },
      });
      expect(hasTreasuresInHand(state, "human")).toBe(true);
    });

    it("should return true when mixed treasures and actions in hand", () => {
      const state = createMockGameState({
        players: {
          human: mockPlayer(["Copper", "Village", "Silver"]),
          ai: mockPlayer(),
        },
      });
      expect(hasTreasuresInHand(state, "human")).toBe(true);
    });

    it("should default to human player when playerId is not provided", () => {
      const state = createMockGameState({
        players: {
          human: mockPlayer(["Gold"]),
          ai: mockPlayer(),
        },
      });
      expect(hasTreasuresInHand(state)).toBe(true);
    });

    it("should work for non-human players", () => {
      const state = createMockGameState({
        players: {
          human: mockPlayer(),
          ai: mockPlayer(["Copper", "Gold"]),
        },
      });
      expect(hasTreasuresInHand(state, "ai")).toBe(true);
    });
  });
});
