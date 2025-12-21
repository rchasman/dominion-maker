import { describe, it, expect } from "bun:test";
import {
  hasPlayableActions,
  hasTreasuresInHand,
} from "./derived-state";
import type { GameState } from "../types/game-state";

describe("derived-state utilities", () => {
  const createMockGameState = (
    overrides: Partial<GameState> = {}
  ): GameState => ({
    gameId: "test-game",
    version: "1.0",
    gameOver: false,
    turn: 1,
    phase: "action",
    actions: 1,
    buys: 1,
    coins: 0,
    activePlayerId: "human",
    players: {
      human: {
        playerId: "human",
        name: "Human",
        deck: [],
        hand: [],
        inPlay: [],
        discard: [],
        trash: [],
        deckSize: 0,
        discardSize: 0,
      },
      ai: {
        playerId: "ai",
        name: "AI",
        deck: [],
        hand: [],
        inPlay: [],
        discard: [],
        trash: [],
        deckSize: 0,
        discardSize: 0,
      },
    },
    supply: {},
    trash: [],
    pendingChoice: null,
    ...overrides,
  });

  describe("hasPlayableActions", () => {
    it("should return false when gameState is null", () => {
      expect(hasPlayableActions(null)).toBe(false);
    });

    it("should return false when gameState is undefined", () => {
      expect(hasPlayableActions()).toBe(false);
    });

    it("should return false when player does not exist", () => {
      const state = createMockGameState();
      expect(hasPlayableActions(state, "nonexistent")).toBe(false);
    });

    it("should return false when hand is empty", () => {
      const state = createMockGameState({
        actions: 1,
        players: {
          human: {
            playerId: "human",
            name: "Human",
            deck: [],
            hand: [],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
          ai: {
            playerId: "ai",
            name: "AI",
            deck: [],
            hand: [],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
        },
      });
      expect(hasPlayableActions(state, "human")).toBe(false);
    });

    it("should return false when no action cards in hand", () => {
      const state = createMockGameState({
        actions: 1,
        players: {
          human: {
            playerId: "human",
            name: "Human",
            deck: [],
            hand: ["Copper", "Silver", "Gold"],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
          ai: {
            playerId: "ai",
            name: "AI",
            deck: [],
            hand: [],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
        },
      });
      expect(hasPlayableActions(state, "human")).toBe(false);
    });

    it("should return false when actions count is zero", () => {
      const state = createMockGameState({
        actions: 0,
        players: {
          human: {
            playerId: "human",
            name: "Human",
            deck: [],
            hand: ["Village"],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
          ai: {
            playerId: "ai",
            name: "AI",
            deck: [],
            hand: [],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
        },
      });
      expect(hasPlayableActions(state, "human")).toBe(false);
    });

    it("should return true when hand has action card and actions > 0", () => {
      const state = createMockGameState({
        actions: 1,
        players: {
          human: {
            playerId: "human",
            name: "Human",
            deck: [],
            hand: ["Village"],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
          ai: {
            playerId: "ai",
            name: "AI",
            deck: [],
            hand: [],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
        },
      });
      expect(hasPlayableActions(state, "human")).toBe(true);
    });

    it("should default to human player when playerId is not provided", () => {
      const state = createMockGameState({
        actions: 1,
        players: {
          human: {
            playerId: "human",
            name: "Human",
            deck: [],
            hand: ["Village"],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
          ai: {
            playerId: "ai",
            name: "AI",
            deck: [],
            hand: [],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
        },
      });
      expect(hasPlayableActions(state)).toBe(true);
    });

    it("should handle multiple action cards in hand", () => {
      const state = createMockGameState({
        actions: 2,
        players: {
          human: {
            playerId: "human",
            name: "Human",
            deck: [],
            hand: ["Village", "Smithy", "Market"],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
          ai: {
            playerId: "ai",
            name: "AI",
            deck: [],
            hand: [],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
        },
      });
      expect(hasPlayableActions(state, "human")).toBe(true);
    });

    it("should work for non-human players", () => {
      const state = createMockGameState({
        actions: 1,
        players: {
          human: {
            playerId: "human",
            name: "Human",
            deck: [],
            hand: [],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
          ai: {
            playerId: "ai",
            name: "AI",
            deck: [],
            hand: ["Cellar"],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
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
      expect(hasTreasuresInHand()).toBe(false);
    });

    it("should return false when player does not exist", () => {
      const state = createMockGameState();
      expect(hasTreasuresInHand(state, "nonexistent")).toBe(false);
    });

    it("should return false when hand is empty", () => {
      const state = createMockGameState({
        players: {
          human: {
            playerId: "human",
            name: "Human",
            deck: [],
            hand: [],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
          ai: {
            playerId: "ai",
            name: "AI",
            deck: [],
            hand: [],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
        },
      });
      expect(hasTreasuresInHand(state, "human")).toBe(false);
    });

    it("should return false when no treasure cards in hand", () => {
      const state = createMockGameState({
        players: {
          human: {
            playerId: "human",
            name: "Human",
            deck: [],
            hand: ["Village", "Smithy", "Militia"],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
          ai: {
            playerId: "ai",
            name: "AI",
            deck: [],
            hand: [],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
        },
      });
      expect(hasTreasuresInHand(state, "human")).toBe(false);
    });

    it("should return true when Copper in hand", () => {
      const state = createMockGameState({
        players: {
          human: {
            playerId: "human",
            name: "Human",
            deck: [],
            hand: ["Copper"],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
          ai: {
            playerId: "ai",
            name: "AI",
            deck: [],
            hand: [],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
        },
      });
      expect(hasTreasuresInHand(state, "human")).toBe(true);
    });

    it("should return true when Silver in hand", () => {
      const state = createMockGameState({
        players: {
          human: {
            playerId: "human",
            name: "Human",
            deck: [],
            hand: ["Silver"],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
          ai: {
            playerId: "ai",
            name: "AI",
            deck: [],
            hand: [],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
        },
      });
      expect(hasTreasuresInHand(state, "human")).toBe(true);
    });

    it("should return true when Gold in hand", () => {
      const state = createMockGameState({
        players: {
          human: {
            playerId: "human",
            name: "Human",
            deck: [],
            hand: ["Gold"],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
          ai: {
            playerId: "ai",
            name: "AI",
            deck: [],
            hand: [],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
        },
      });
      expect(hasTreasuresInHand(state, "human")).toBe(true);
    });

    it("should return true when multiple treasures in hand", () => {
      const state = createMockGameState({
        players: {
          human: {
            playerId: "human",
            name: "Human",
            deck: [],
            hand: ["Copper", "Silver", "Gold"],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
          ai: {
            playerId: "ai",
            name: "AI",
            deck: [],
            hand: [],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
        },
      });
      expect(hasTreasuresInHand(state, "human")).toBe(true);
    });

    it("should return true when mixed treasures and actions in hand", () => {
      const state = createMockGameState({
        players: {
          human: {
            playerId: "human",
            name: "Human",
            deck: [],
            hand: ["Copper", "Village", "Silver"],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
          ai: {
            playerId: "ai",
            name: "AI",
            deck: [],
            hand: [],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
        },
      });
      expect(hasTreasuresInHand(state, "human")).toBe(true);
    });

    it("should default to human player when playerId is not provided", () => {
      const state = createMockGameState({
        players: {
          human: {
            playerId: "human",
            name: "Human",
            deck: [],
            hand: ["Gold"],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
          ai: {
            playerId: "ai",
            name: "AI",
            deck: [],
            hand: [],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
        },
      });
      expect(hasTreasuresInHand(state)).toBe(true);
    });

    it("should work for non-human players", () => {
      const state = createMockGameState({
        players: {
          human: {
            playerId: "human",
            name: "Human",
            deck: [],
            hand: [],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
          ai: {
            playerId: "ai",
            name: "AI",
            deck: [],
            hand: ["Copper", "Gold"],
            inPlay: [],
            discard: [],
            trash: [],
            deckSize: 0,
            discardSize: 0,
          },
        },
      });
      expect(hasTreasuresInHand(state, "ai")).toBe(true);
    });
  });
});
