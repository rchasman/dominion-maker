import { describe, it, expect } from "bun:test";
import { getPlayerPerspective } from "./player-utils";
import type { GameState, PlayerState } from "../types/game-state";
import type { GameMode } from "../types/game-mode";

describe("player-utils", () => {
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

  describe("getPlayerPerspective", () => {
    it("returns player0 and player1 for multiplayer with null state", () => {
      const result = getPlayerPerspective(null, "multiplayer", null);
      expect(result.localPlayerId).toBe("player0");
      expect(result.opponentPlayerId).toBe("player1");
      expect(result.allPlayerIds).toEqual(["player0", "player1"]);
    });

    it("returns players from state when state is provided", () => {
      const state: GameState = {
        players: { human: createMockPlayer(), ai: createMockPlayer() },
        activePlayerId: "human",
        phase: "action",
        turn: 1,
        supply: {},
        trash: [],
        pendingChoice: null,
      };
      const result = getPlayerPerspective(state, "single-player", null);
      expect(result.allPlayerIds).toContain("human");
      expect(result.allPlayerIds).toContain("ai");
    });

    it("reorders players in multiplayer when localPlayerId is second", () => {
      const state: GameState = {
        players: { player0: createMockPlayer(), player1: createMockPlayer() },
        activePlayerId: "player0",
        phase: "action",
        turn: 1,
        supply: {},
        trash: [],
        pendingChoice: null,
      };
      const result = getPlayerPerspective(state, "multiplayer", "player1");
      expect(result.localPlayerId).toBe("player1");
      expect(result.opponentPlayerId).toBe("player0");
    });

    it("keeps player order when localPlayerId is first in multiplayer", () => {
      const state: GameState = {
        players: { player0: createMockPlayer(), player1: createMockPlayer() },
        activePlayerId: "player0",
        phase: "action",
        turn: 1,
        supply: {},
        trash: [],
        pendingChoice: null,
      };
      const result = getPlayerPerspective(state, "multiplayer", "player0");
      expect(result.localPlayerId).toBe("player0");
      expect(result.opponentPlayerId).toBe("player1");
    });

    it("does not reorder players in engine mode", () => {
      const state: GameState = {
        players: { human: createMockPlayer(), ai: createMockPlayer() },
        activePlayerId: "human",
        phase: "action",
        turn: 1,
        supply: {},
        trash: [],
        pendingChoice: null,
      };
      const result = getPlayerPerspective(state, "engine", "ai");
      expect(result.localPlayerId).toBe("human");
      expect(result.opponentPlayerId).toBe("ai");
    });

    it("returns players from getPlayersForMode when state is null for engine", () => {
      const result = getPlayerPerspective(null, "engine", null);
      expect(result.allPlayerIds.length).toBeGreaterThan(0);
    });

    it("returns players from getPlayersForMode when state is null for hybrid", () => {
      const result = getPlayerPerspective(null, "hybrid", null);
      expect(result.allPlayerIds.length).toBeGreaterThan(0);
    });

    it("handles multiplayer without localPlayerId (no reordering)", () => {
      const state: GameState = {
        players: { player0: createMockPlayer(), player1: createMockPlayer() },
        activePlayerId: "player0",
        phase: "action",
        turn: 1,
        supply: {},
        trash: [],
        pendingChoice: null,
      };
      const result = getPlayerPerspective(state, "multiplayer", null);
      expect(result.localPlayerId).toBe("player0");
      expect(result.opponentPlayerId).toBe("player1");
    });
  });
});
