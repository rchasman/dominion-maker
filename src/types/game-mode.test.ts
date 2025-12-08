import { describe, it, expect } from "bun:test";
import { GAME_MODE_CONFIG } from "./game-mode";

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

    it("should have correct player IDs", () => {
      expect(config.players).toEqual(["ai1", "ai2"]);
    });

    it("should identify both AI players correctly", () => {
      expect(config.isAIPlayer("ai1")).toBe(true);
      expect(config.isAIPlayer("ai2")).toBe(true);
      expect(config.isAIPlayer("ai")).toBe(false);
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
      Object.values(GAME_MODE_CONFIG).forEach(config => {
        expect(config.players).toHaveLength(2);
      });
    });

    it("should have unique player IDs within each mode", () => {
      Object.values(GAME_MODE_CONFIG).forEach(config => {
        const uniquePlayers = new Set(config.players);
        expect(uniquePlayers.size).toBe(config.players.length);
      });
    });

    it("should identify at least one AI player in each mode", () => {
      Object.values(GAME_MODE_CONFIG).forEach(config => {
        const hasAI = config.players.some(p => config.isAIPlayer(p));
        expect(hasAI).toBe(true);
      });
    });
  });
});
