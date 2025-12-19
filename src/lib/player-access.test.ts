import { describe, it, expect } from "bun:test";
import { getPlayer, hasPlayer } from "./player-access";
import type { GameState, PlayerState } from "../types/game-state";

describe("player-access", () => {
  const createMockPlayer = (): PlayerState => ({
    deck: ["Copper"],
    hand: ["Estate"],
    discard: ["Silver"],
    inPlay: [],
    actions: 1,
    buys: 1,
    coins: 0,
    deckTopRevealed: false,
  });

  const createMockState = (): GameState => ({
    players: {
      human: createMockPlayer(),
      ai: createMockPlayer(),
    },
    activePlayerId: "human",
    phase: "action",
    turn: 1,
    supply: {},
    trash: [],
    pendingChoice: null,
  });

  describe("getPlayer", () => {
    it("returns player when player exists", () => {
      const state = createMockState();
      const player = getPlayer(state, "human");
      expect(player).toBeDefined();
      expect(player.deck).toEqual(["Copper"]);
    });

    it("throws error when player does not exist", () => {
      const state = createMockState();
      expect(() => getPlayer(state, "nonexistent" as any)).toThrow(
        "Player nonexistent not found in game state",
      );
    });

    it("returns correct player for different playerIds", () => {
      const state = createMockState();
      const humanPlayer = getPlayer(state, "human");
      const aiPlayer = getPlayer(state, "ai");
      expect(humanPlayer).not.toBe(aiPlayer);
    });

    it("returns player with all expected properties", () => {
      const state = createMockState();
      const player = getPlayer(state, "human");
      expect(player).toHaveProperty("deck");
      expect(player).toHaveProperty("hand");
      expect(player).toHaveProperty("discard");
      expect(player).toHaveProperty("inPlay");
      expect(player).toHaveProperty("actions");
      expect(player).toHaveProperty("buys");
      expect(player).toHaveProperty("coins");
    });
  });

  describe("hasPlayer", () => {
    it("returns true when player exists", () => {
      const state = createMockState();
      expect(hasPlayer(state, "human")).toBe(true);
      expect(hasPlayer(state, "ai")).toBe(true);
    });

    it("returns false when player does not exist", () => {
      const state = createMockState();
      expect(hasPlayer(state, "nonexistent" as any)).toBe(false);
    });

    it("handles empty players object", () => {
      const state: GameState = {
        players: {},
        activePlayerId: "human",
        phase: "action",
        turn: 1,
        supply: {},
        trash: [],
        pendingChoice: null,
      };
      expect(hasPlayer(state, "human")).toBe(false);
    });

    it("returns correct result for multiple players", () => {
      const state = createMockState();
      expect(hasPlayer(state, "human")).toBe(true);
      expect(hasPlayer(state, "ai")).toBe(true);
      expect(hasPlayer(state, "other" as any)).toBe(false);
    });
  });
});
