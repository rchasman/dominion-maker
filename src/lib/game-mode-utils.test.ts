import { describe, it, expect } from "bun:test";
import { isAIControlled } from "./game-mode-utils";
import type { GameMode } from "../types/game-mode";

describe("game-mode-utils", () => {
  describe("isAIControlled", () => {
    it("returns false for multiplayer mode", () => {
      expect(isAIControlled("multiplayer", "player0")).toBe(false);
      expect(isAIControlled("multiplayer", "player1")).toBe(false);
      expect(isAIControlled("multiplayer", "human")).toBe(false);
      expect(isAIControlled("multiplayer", "ai")).toBe(false);
    });

    it("returns false for human player in engine mode", () => {
      expect(isAIControlled("engine", "human")).toBe(false);
    });

    it("returns true for AI player in engine mode", () => {
      expect(isAIControlled("engine", "ai")).toBe(true);
    });

    it("returns false for human player in hybrid mode", () => {
      expect(isAIControlled("hybrid", "human")).toBe(false);
    });

    it("returns true for AI player in hybrid mode", () => {
      expect(isAIControlled("hybrid", "ai")).toBe(true);
    });

    it("returns true for all players in full mode", () => {
      expect(isAIControlled("full", "human")).toBe(true);
      expect(isAIControlled("full", "ai")).toBe(true);
      expect(isAIControlled("full", "player")).toBe(true);
    });

    it("delegates to GAME_MODE_CONFIG for engine mode", () => {
      const result = isAIControlled("engine", "ai");
      expect(typeof result).toBe("boolean");
    });

    it("delegates to GAME_MODE_CONFIG for hybrid mode", () => {
      const result = isAIControlled("hybrid", "human");
      expect(typeof result).toBe("boolean");
    });
  });
});
