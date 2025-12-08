import { describe, it, expect } from "bun:test";
import { GAME_MODE_CONFIG, getPlayersForMode } from "./game-mode";

describe("GAME_MODE_CONFIG", () => {
  describe("engine mode", () => {
    const config = GAME_MODE_CONFIG.engine;

    it("should have correct player IDs", () => {
      expect(config.players).toEqual(["human", "ai"]);
    });

    it("should identify AI player correctly", () => {
      expect(config.isAIPlayer("ai")).toBe(true);
      expect(config.isAIPlayer("human")).toBe(false);
      expect(config.isAIPlayer("ai1")).toBe(false);
      expect(config.isAIPlayer("ai2")).toBe(false);
    });

    it("should have correct metadata", () => {
      expect(config.name).toBe("Engine");
      expect(config.description).toContain("random AI");
      expect(config.logDescription.title).toContain("Engine");
    });
  });

  describe("hybrid mode", () => {
    const config = GAME_MODE_CONFIG.hybrid;

    it("should have correct player IDs", () => {
      expect(config.players).toEqual(["human", "ai"]);
    });

    it("should identify AI player correctly", () => {
      expect(config.isAIPlayer("ai")).toBe(true);
      expect(config.isAIPlayer("human")).toBe(false);
      expect(config.isAIPlayer("ai1")).toBe(false);
      expect(config.isAIPlayer("ai2")).toBe(false);
    });

    it("should have correct metadata", () => {
      expect(config.name).toBe("Hybrid");
      expect(config.description).toContain("Human vs AI");
      expect(config.description).toContain("MAKER");
      expect(config.logDescription.title).toContain("Hybrid");
    });
  });

  describe("full mode", () => {
    const config = GAME_MODE_CONFIG.full;
    const players = getPlayersForMode("full");

    it("should generate player IDs dynamically", () => {
      expect(players).toHaveLength(2);
      expect(players[0]).toMatch(/^[a-z]+$/i); // Should be a name
      expect(players[1]).toMatch(/^[a-z]+$/i); // Should be a name
      expect(players[0]).not.toEqual(players[1]); // Should be different
    });

    it("should identify both AI players correctly", () => {
      expect(config.isAIPlayer(players[0])).toBe(true);
      expect(config.isAIPlayer(players[1])).toBe(true);
      expect(config.isAIPlayer("human")).toBe(false);
    });

    it("should have correct metadata", () => {
      expect(config.name).toBe("Full");
      expect(config.description).toContain("AI vs AI");
      expect(config.description).toContain("Watch");
      expect(config.logDescription.title).toContain("Full");
    });
  });

  describe("all modes", () => {
    it("should have exactly 2 players each", () => {
      (["engine", "hybrid", "full"] as const).forEach(mode => {
        const players = getPlayersForMode(mode);
        expect(players).toHaveLength(2);
      });
    });

    it("should have unique player IDs within each mode", () => {
      (["engine", "hybrid", "full"] as const).forEach(mode => {
        const players = getPlayersForMode(mode);
        const uniquePlayers = new Set(players);
        expect(uniquePlayers.size).toBe(players.length);
      });
    });

    it("should identify at least one AI player in each mode", () => {
      (["engine", "hybrid", "full"] as const).forEach(mode => {
        const config = GAME_MODE_CONFIG[mode];
        const players = getPlayersForMode(mode);
        const hasAI = players.some(p => config.isAIPlayer(p));
        expect(hasAI).toBe(true);
      });
    });
  });
});
